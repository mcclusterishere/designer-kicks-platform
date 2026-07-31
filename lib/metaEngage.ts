import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./db";
import { businessSecret, proofParams } from "./appsecret";

/**
 * The engagement side of the Meta integration: what comes IN (comments,
 * DMs, mentions, delivered by webhook), how we answer it, and the one
 * legal way to look outward (Business Discovery).
 *
 * The line this module holds, because Meta's platform terms hold it:
 * everything here is REACTIVE. We answer people who commented on our
 * posts or messaged our inbox. Nothing in this file can start a
 * conversation with someone who hasn't talked to us — the API refuses
 * it (24-hour messaging window) and the rules engine is shaped so it
 * can't even be asked to.
 */

const FB_API = process.env.GRAPH_API_URL || "https://graph.facebook.com/v23.0";

function pageToken(): string | null {
  return process.env.FB_PAGE_ACCESS_TOKEN || null;
}

export function engageConfigured(): boolean {
  return Boolean(process.env.FB_PAGE_ID && pageToken());
}

/* ------------------------------------------------------------------ */
/* Webhook intake                                                      */
/* ------------------------------------------------------------------ */

/**
 * Meta signs every webhook body with the app secret. No valid
 * signature, no processing — anyone can POST to a public URL, and this
 * check is the only thing making the events trustworthy.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader?.startsWith("sha256=") || !appSecret) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const got = signatureHeader.slice("sha256=".length);
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export type ParsedEvent = {
  platform: string;
  kind: string;
  objectId: string;
  fromName: string | null;
  fromId: string | null;
  text: string | null;
  parentId: string | null;
  /// A quick-reply tap, a postback button, or an m.me ?ref= — the
  /// machine-readable half of what the person did. Not persisted on
  /// MetaEvent; consumed in-flight by the chat bot's router.
  payload?: string | null;
};

/**
 * Flatten Meta's nested webhook payload into rows worth keeping.
 * Deliberately narrow: comments, messages, mentions. Everything else
 * (edits, reaction counts, story insights) is noise for a desk whose
 * job is "somebody said something — answer them".
 *
 * Our own outbound activity is filtered out here, or every auto-reply
 * would come back through the webhook and re-trigger the rules engine
 * in a loop.
 */
export function parseWebhookPayload(payload: unknown): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  const root = payload as {
    object?: string;
    entry?: Array<Record<string, unknown>>;
  };
  const platform = root.object === "instagram" ? "instagram" : "facebook";
  const ourIds = new Set(
    [process.env.FB_PAGE_ID, process.env.IG_USER_ID].filter(Boolean) as string[]
  );

  for (const entry of root.entry ?? []) {
    // Page feed / IG comment changes.
    const changes = (entry.changes ?? []) as Array<{
      field?: string;
      value?: Record<string, unknown>;
    }>;
    for (const ch of changes) {
      const v = ch.value ?? {};
      if (ch.field === "feed" || ch.field === "comments") {
        const item = String(v.item ?? "comment");
        if (item !== "comment" && ch.field === "feed") continue;
        const from = v.from as { id?: string; name?: string; username?: string } | undefined;
        if (from?.id && ourIds.has(from.id)) continue; // our own reply echoing back
        const id = String(v.comment_id ?? (v.id as string | undefined) ?? "");
        if (!id) continue;
        out.push({
          platform,
          kind: "comment",
          objectId: id,
          fromName: from?.name ?? from?.username ?? null,
          fromId: from?.id ?? null,
          text: (v.message as string) ?? (v.text as string) ?? null,
          parentId: String(v.post_id ?? (v.media as { id?: string } | undefined)?.id ?? "") || null,
        });
      }
      if (ch.field === "mention" || ch.field === "mentions") {
        const id = String(v.comment_id ?? v.media_id ?? "");
        if (!id) continue;
        out.push({
          platform,
          kind: "mention",
          objectId: id,
          fromName: null,
          fromId: null,
          text: null,
          parentId: String(v.media_id ?? "") || null,
        });
      }
    }

    // Messenger / IG direct messages, quick-reply taps, button
    // postbacks and m.me referrals — everything a person can DO in a
    // conversation, normalised to one shape so the router upstream has
    // a single case to handle.
    const messaging = (entry.messaging ?? []) as Array<Record<string, unknown>>;
    for (const m of messaging) {
      const sender = m.sender as { id?: string } | undefined;
      if (sender?.id && ourIds.has(sender.id)) continue;

      const msg = m.message as
        | { mid?: string; text?: string; is_echo?: boolean; quick_reply?: { payload?: string } }
        | undefined;
      if (msg?.mid && !msg.is_echo) {
        out.push({
          platform,
          kind: "message",
          objectId: msg.mid,
          fromName: null,
          fromId: sender?.id ?? null,
          text: msg.text ?? null,
          parentId: null,
          payload: msg.quick_reply?.payload ?? null,
        });
        continue;
      }

      // A postback (Get Started, ice breaker, menu button) has no mid;
      // sender + timestamp is the stable identity Meta gives us.
      const postback = m.postback as
        | { payload?: string; title?: string; referral?: { ref?: string } }
        | undefined;
      if (postback?.payload && sender?.id) {
        out.push({
          platform,
          kind: "message",
          objectId: `pb-${sender.id}-${String(m.timestamp ?? "")}`,
          fromName: null,
          fromId: sender.id,
          text: postback.title ?? null,
          parentId: null,
          payload: postback.payload,
        });
        continue;
      }

      // Someone arrived through an m.me/…?ref= link mid-conversation.
      const referral = m.referral as { ref?: string } | undefined;
      if (referral?.ref && sender?.id) {
        out.push({
          platform,
          kind: "message",
          objectId: `ref-${sender.id}-${String(m.timestamp ?? "")}`,
          fromName: null,
          fromId: sender.id,
          text: null,
          parentId: null,
          payload: `ref:${referral.ref}`,
        });
      }
    }
  }
  return out;
}

/**
 * Store parsed events, skipping webhook redeliveries. Returns the ones
 * that were genuinely new — the chat bot routes ONLY those, so a
 * redelivered webhook can never make it answer the same person twice.
 */
export async function storeEvents(events: ParsedEvent[]): Promise<ParsedEvent[]> {
  const fresh: ParsedEvent[] = [];
  for (const e of events) {
    try {
      const { payload: _payload, ...row } = e;
      await prisma.metaEvent.create({ data: row });
      fresh.push(e);
    } catch {
      // Unique collision on objectId — Meta redelivered, we already
      // have it. Exactly what the unique index is for.
    }
  }
  return fresh;
}

/* ------------------------------------------------------------------ */
/* Outbound replies (all reactive)                                     */
/* ------------------------------------------------------------------ */

async function graph(
  path: string,
  params: Record<string, string>,
  method: "GET" | "POST" = "GET"
): Promise<Record<string, unknown>> {
  const token = pageToken();
  if (!token) throw new Error("Page token not configured");
  const qs = new URLSearchParams({
    ...params,
    access_token: token,
    ...proofParams(token, businessSecret()),
  });
  const url = method === "GET" ? `${FB_API}/${path}?${qs}` : `${FB_API}/${path}`;
  const res = await fetch(url, {
    method,
    ...(method === "POST" ? { body: qs } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    [k: string]: unknown;
  };
  if (!res.ok || json.error) throw new Error(json.error?.message || `Graph ${res.status}`);
  return json;
}

/** Public reply under a comment. IG replies use a different edge. */
export async function replyToComment(
  platform: string,
  commentId: string,
  text: string
): Promise<void> {
  if (platform === "instagram") {
    await graph(`${commentId}/replies`, { message: text }, "POST");
  } else {
    await graph(`${commentId}/comments`, { message: text }, "POST");
  }
}

/** Hide (or unhide) a comment without deleting the record of it. */
export async function hideComment(commentId: string, hide: boolean): Promise<void> {
  await graph(commentId, { is_hidden: String(hide) }, "POST");
}

/**
 * WHO is sending, which decides what Meta permits.
 *
 *   "automation"  the bot. Legal only inside the 24-hour window a
 *                 person opens by messaging us. messaging_type RESPONSE.
 *   "human_agent" a person sitting at the Engagement desk, typing.
 *                 Carries the HUMAN_AGENT tag, which Meta grants "to
 *                 provide human agent support in cases where a user's
 *                 issue cannot be resolved in the standard messaging
 *                 window" — e.g. someone messaged Saturday night and a
 *                 human answers Monday.
 *
 * This is a POLICY line, not a technical one, and it is the reason this
 * is an explicit argument rather than something inferred from elapsed
 * time. Stamping HUMAN_AGENT on an automated reply tells Meta a human
 * is answering when none is. That is a misrepresentation to the
 * platform, and messaging access is exactly what it costs.
 *
 * So the tag is unreachable from the automation: every chatbot and
 * rules-engine path takes the default, and only the admin desk — behind
 * requireAdmin(), with a human's hands on the keyboard — passes
 * "human_agent". Nothing in this file upgrades a sender on its own.
 */
export type ReplySender = "automation" | "human_agent";

/**
 * Send into a conversation.
 *
 * `quickReplies` renders as tap buttons under the message — Meta caps
 * them at 13 with 20-character labels, enforced here so a fat-fingered
 * flow row degrades to a trimmed button instead of a failed send.
 */
export async function sendDmReply(
  recipientId: string,
  text: string,
  quickReplies?: Array<{ label: string; payload: string }>,
  sender: ReplySender = "automation"
): Promise<void> {
  const message: Record<string, unknown> = { text };
  if (quickReplies && quickReplies.length > 0) {
    message.quick_replies = quickReplies.slice(0, 13).map((q) => ({
      content_type: "text",
      title: q.label.slice(0, 20),
      payload: q.payload,
    }));
  }
  const byHuman = sender === "human_agent";
  await graph(
    "me/messages",
    {
      recipient: JSON.stringify({ id: recipientId }),
      messaging_type: byHuman ? "MESSAGE_TAG" : "RESPONSE",
      ...(byHuman ? { tag: "HUMAN_AGENT" } : {}),
      message: JSON.stringify(message),
    },
    "POST"
  );
}

/**
 * The comment-to-DM door: a PRIVATE reply to a public comment, landing
 * in the commenter's inbox. Meta's one sanctioned way to start a
 * conversation with someone who hasn't messaged us — and it's strictly
 * one per comment, ever, enforced by Meta and respected by the caller
 * (which only routes freshly stored events).
 *
 * The private reply itself does NOT open the 24-hour window; only the
 * person's answer to it does. So the text has to earn a reply, not
 * just deliver a link.
 */
export async function sendPrivateReply(
  commentId: string,
  text: string,
  quickReplies?: Array<{ label: string; payload: string }>
): Promise<void> {
  const message: Record<string, unknown> = { text };
  if (quickReplies && quickReplies.length > 0) {
    message.quick_replies = quickReplies.slice(0, 13).map((q) => ({
      content_type: "text",
      title: q.label.slice(0, 20),
      payload: q.payload,
    }));
  }
  await graph(
    "me/messages",
    {
      recipient: JSON.stringify({ comment_id: commentId }),
      message: JSON.stringify(message),
    },
    "POST"
  );
}

/* ------------------------------------------------------------------ */
/* The rules engine                                                    */
/* ------------------------------------------------------------------ */

/** Pure matcher, split out so the verify suite can hammer it. */
export function ruleMatches(
  rule: { kind: string; trigger: string | null },
  event: { kind: string; text: string | null }
): boolean {
  if (rule.kind === "dm_welcome") return event.kind === "message";
  if (rule.kind === "comment_keyword") {
    if (event.kind !== "comment" || !event.text || !rule.trigger) return false;
    return event.text.toLowerCase().includes(rule.trigger.toLowerCase());
  }
  return false;
}

/**
 * Run the standing rules over freshly stored events. First matching
 * rule wins per event — two keyword rules both matching one comment
 * should not produce two replies from the same page.
 */
export async function runAutomation(events: ParsedEvent[]): Promise<void> {
  if (events.length === 0 || !engageConfigured()) return;
  const rules = await prisma.socialRule.findMany({ where: { active: true } });
  if (rules.length === 0) return;

  for (const e of events) {
    const rule = rules.find((r) => ruleMatches(r, e));
    if (!rule) continue;
    try {
      if (e.kind === "comment") {
        // The same canned line posted twice under one person's comments
        // in a day is the exact texture of comment spam. One rule reply
        // per author per day; the rest wait for a human.
        if (e.fromId) {
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recent = await prisma.metaEvent.count({
            where: {
              fromId: e.fromId,
              autoNote: { startsWith: "auto-replied" },
              receivedAt: { gte: dayAgo },
            },
          });
          if (recent > 0) continue;
        }
        await replyToComment(e.platform, e.objectId, rule.reply);
      } else if (e.kind === "message" && e.fromId) {
        // One welcome per person: if we've already welcomed this sender,
        // stay quiet — a bot that answers every message isn't a welcome,
        // it's a wall between the person and a human.
        const prior = await prisma.metaEvent.count({
          where: { kind: "message", fromId: e.fromId, autoNote: { not: null } },
        });
        if (prior > 0) continue;
        await sendDmReply(e.fromId, rule.reply);
      } else {
        continue;
      }
      await prisma.metaEvent.update({
        where: { objectId: e.objectId },
        data: { autoNote: `auto-replied via rule: ${rule.trigger ?? rule.kind}`, status: "HANDLED" },
      });
      await prisma.socialRule.update({
        where: { id: rule.id },
        data: { fired: { increment: 1 } },
      });
    } catch (err) {
      console.error(`[automation] rule ${rule.id} failed on ${e.objectId}:`, err);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Inbox reads + the legal outward look                                */
/* ------------------------------------------------------------------ */

export type InboxConversation = {
  id: string;
  platform: string;
  snippet: string;
  updatedTime: string;
  participants: string[];
  senderId: string | null;
};

/** Live Page inbox — Messenger and IG DMs — straight off the Graph. */
export async function listConversations(): Promise<InboxConversation[]> {
  if (!engageConfigured()) return [];
  const pageId = process.env.FB_PAGE_ID!;
  const ourIds = new Set(
    [process.env.FB_PAGE_ID, process.env.IG_USER_ID].filter(Boolean) as string[]
  );
  const all: InboxConversation[] = [];
  for (const platform of ["messenger", "instagram"]) {
    try {
      const json = await graph(`${pageId}/conversations`, {
        platform,
        fields: "id,snippet,updated_time,participants",
        limit: "15",
      });
      for (const c of (json.data as Array<Record<string, unknown>> | undefined) ?? []) {
        const parts =
          ((c.participants as { data?: Array<{ name?: string; id?: string }> })?.data ?? []);
        const other = parts.find((p) => p.id && !ourIds.has(p.id));
        all.push({
          id: String(c.id),
          platform,
          snippet: (c.snippet as string) ?? "",
          updatedTime: (c.updated_time as string) ?? "",
          participants: parts.map((p) => p.name ?? "?"),
          senderId: other?.id ?? null,
        });
      }
    } catch (e) {
      console.error(`[inbox] ${platform} list failed:`, e);
    }
  }
  return all.sort((a, b) => b.updatedTime.localeCompare(a.updatedTime));
}

export type DiscoveredAccount = {
  username: string;
  name: string | null;
  followers: number;
  mediaCount: number;
  biography: string | null;
  website: string | null;
};

/**
 * Business Discovery: the one sanctioned way to look up ANOTHER
 * public business/creator IG account by handle — follower count, bio,
 * post count — for scouting customizers to invite. This is API-served
 * public business data, not scraping, and it only works on
 * professional accounts (a personal account returns an error, which we
 * report as "not findable" rather than trying harder — trying harder
 * IS the thing that's prohibited).
 */
export async function discoverInstagramAccount(
  username: string
): Promise<DiscoveredAccount | { error: string }> {
  const igId = process.env.IG_USER_ID;
  if (!igId || !engageConfigured()) return { error: "Instagram isn't connected yet." };
  const clean = username.replace(/^@/, "").trim();
  if (!/^[\w.]{1,30}$/.test(clean)) return { error: "That doesn't look like an IG handle." };
  try {
    const json = await graph(igId, {
      fields: `business_discovery.username(${clean}){username,name,followers_count,media_count,biography,website}`,
    });
    const d = json.business_discovery as Record<string, unknown> | undefined;
    if (!d) return { error: "No business account under that handle." };
    return {
      username: String(d.username ?? clean),
      name: (d.name as string) ?? null,
      followers: Number(d.followers_count ?? 0),
      mediaCount: Number(d.media_count ?? 0),
      biography: (d.biography as string) ?? null,
      website: (d.website as string) ?? null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "lookup failed";
    // Personal accounts and typos both land here; the distinction isn't
    // ours to probe further.
    return { error: /cannot be found|does not exist|Unsupported/i.test(msg) ? "Not a public business/creator account — invite them the manual way." : msg };
  }
}
