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
        // A share is someone putting OUR post on THEIR wall — the one
        // feed item besides comments worth waking up for. Everything
        // else (likes, reaction counts, edits) stays noise.
        if (item === "share" && ch.field === "feed") {
          const sharer = v.from as { id?: string; name?: string } | undefined;
          if (sharer?.id && ourIds.has(sharer.id)) continue; // our own cross-post
          const shareId = String(v.post_id ?? v.share_id ?? "");
          if (!shareId) continue;
          out.push({
            platform,
            kind: "share",
            objectId: shareId,
            fromName: sharer?.name ?? null,
            fromId: sharer?.id ?? null,
            text: (v.message as string) ?? null,
            parentId: String(v.parent_id ?? "") || null,
          });
          continue;
        }
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

/**
 * Exported so the comment harvest shares this exact call path rather
 * than growing a second one. The appsecret proof, the timeout and the
 * answered-vs-unreachable distinction below are all load-bearing, and a
 * copy of them somewhere else would drift.
 */
export async function graph(
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
  // Meta ANSWERED and said no. That is a different fact from a timeout
  // or a DNS failure, where we have no idea whether the message landed,
  // and the button degrade below is only safe on the first kind: a
  // resend after a possible delivery double-messages a real person.
  if (!res.ok || json.error) {
    throw new GraphError(json.error?.message || `Graph ${res.status}`);
  }
  return json;
}

/**
 * What OUR post said, fetched by the parent id a comment webhook
 * carries. This is the difference between the bot reading "2" as noise
 * and reading it as a vote — the Page runs "which shoe: 1, 2 or 3?"
 * posts, so the comment only means something next to the caption.
 *
 * One post pulls hundreds of comments, so the caption is cached in
 * memory: a viral post costs one Graph call, not one per commenter.
 * Railway runs a single long-lived process, which is what makes a
 * module-level map an honest cache here.
 */
export type PostContext = { text: string | null; imageUrl: string | null };
const postCache = new Map<string, { ctx: PostContext; at: number }>();
const POST_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const POST_CACHE_MAX = 500;

export async function fetchPostContext(
  platform: string,
  parentId: string | null
): Promise<PostContext> {
  if (!parentId) return { text: null, imageUrl: null };
  const hit = postCache.get(parentId);
  if (hit && Date.now() - hit.at < POST_CACHE_TTL_MS) return hit.ctx;
  const ctx: PostContext = { text: null, imageUrl: null };
  try {
    // The field lists are PER PLATFORM, not merged: an FB post carries
    // message + attachments, IG media carries caption + media_url —
    // and Graph errors on a field the node doesn't have, it doesn't
    // ignore it. The first version of this asked both platforms for
    // "message,caption" and every Instagram fetch silently nulled.
    if (platform === "instagram") {
      const json = await graph(parentId, { fields: "caption,media_url,media_type" });
      ctx.text = (json.caption as string) ?? null;
      const mt = String(json.media_type ?? "");
      ctx.imageUrl = mt === "VIDEO" ? null : ((json.media_url as string) ?? null);
    } else {
      const json = await graph(parentId, {
        fields: "message,attachments{media,subattachments.limit(1){media}}",
      });
      ctx.text = (json.message as string) ?? null;
      const att = (json.attachments as { data?: Array<Record<string, unknown>> })?.data?.[0];
      const media = (att?.media ?? (att?.subattachments as { data?: Array<Record<string, unknown>> })?.data?.[0]?.media) as
        | { image?: { src?: string } }
        | undefined;
      ctx.imageUrl = media?.image?.src ?? null;
    }
  } catch {
    // A deleted post or a permissions hiccup shouldn't kill the reply —
    // the bot just answers without context. Cache the miss too, so a
    // dead post isn't re-fetched per comment.
  }
  if (postCache.size >= POST_CACHE_MAX) {
    const oldest = postCache.keys().next().value;
    if (oldest !== undefined) postCache.delete(oldest);
  }
  postCache.set(parentId, { ctx, at: Date.now() });
  return ctx;
}

/**
 * Like something as the Page. Used on shares of our posts — the one
 * gesture that works even when the sharer's privacy settings wall off
 * everything else. A refusal here (friends-only post, deleted share)
 * is the platform saying "you can't see this", which is an answer, not
 * an error — so the caller treats false as "leave it be".
 */
/**
 * The photo somebody attached to their OWN comment.
 *
 * Facebook only. An Instagram comment cannot carry an attachment at
 * all: the IG Comment node has no attachment field, and its `media`
 * field is the parent post, not something the commenter uploaded.
 *
 * The field is `attachment`, SINGULAR. The plural `attachments` is the
 * POST edge, and asking a comment for it returns nothing. That
 * conflation is a known bug class and this codebase has already been
 * bitten once by assuming a post field works on another node.
 *
 * Returns a still-image URL or null. The URL is deliberately not
 * returned for storage: fbcdn links carry an `oe=` expiry and are dead
 * within hours, so the caller must download inside the same pass.
 */
export async function fetchCommentPhoto(
  platform: string,
  commentId: string
): Promise<string | null> {
  if (platform !== "facebook") return null;
  const full =
    "attachment{type,media_type,media{image{src}},subattachments{data{type,media_type,media{image{src}}}}}";
  // The narrow list is the documented core; the wide one is assembled
  // from verified field names but never seen as a documented example
  // request, so a 400 on it is expected rather than exceptional.
  const narrow = "attachment{media_type,media{image{src}}}";
  let json: Record<string, unknown> | null = null;
  for (const fields of [full, narrow]) {
    try {
      json = await graph(commentId, { fields });
      break;
    } catch (e) {
      if (fields === narrow) {
        console.error(`[metaEngage] comment attachment read failed for ${commentId}:`, e);
        return null;
      }
    }
  }
  if (!json) return null;

  type Att = {
    type?: string;
    media_type?: string;
    media?: { image?: { src?: string } };
    subattachments?: { data?: Att[] };
  };
  // An animated GIF comes back as type "animated_image_video" with
  // media_type "video", and its image.src is only a frozen preview
  // frame. Sending that to a vision model produces confident nonsense
  // about a still that was never the point. Both discriminators are
  // required: media_type is coarse, type is fine-grained, and anything
  // unrecognised is a skip rather than an assumed photo.
  const isStill = (a: Att | undefined): boolean => {
    if (!a) return false;
    const mt = String(a.media_type ?? "").toLowerCase();
    const t = String(a.type ?? "").toLowerCase();
    if (mt !== "photo" && mt !== "image") return false;
    if (t.includes("video") || t.includes("animated")) return false;
    return Boolean(a.media?.image?.src);
  };

  const att = json.attachment as Att | undefined;
  if (isStill(att)) return att!.media!.image!.src!;
  // A multi-photo comment hangs the real photos off subattachments.
  // One is all we need and all we send.
  for (const sub of att?.subattachments?.data ?? []) {
    if (isStill(sub)) return sub.media!.image!.src!;
  }
  return null;
}

export async function likeObject(objectId: string): Promise<boolean> {
  try {
    await graph(`${objectId}/likes`, {}, "POST");
    return true;
  } catch {
    return false;
  }
}

/**
 * Public reply under a comment. IG replies use a different edge, and
 * only Facebook comments can carry a GIF — attachment_share_url is a
 * Pages-comment parameter with no Instagram equivalent, so the gif is
 * quietly dropped there rather than failing the reply.
 */
export async function replyToComment(
  platform: string,
  commentId: string,
  text: string,
  gifUrl?: string | null
): Promise<void> {
  if (platform === "instagram") {
    await graph(`${commentId}/replies`, { message: text }, "POST");
  } else {
    await graph(
      `${commentId}/comments`,
      { message: text, ...(gifUrl ? { attachment_share_url: gifUrl } : {}) },
      "POST"
    );
  }
}

/**
 * Hide (or unhide) a comment without deleting the record of it.
 *
 * The two platforms name this differently and neither complains about
 * the other's spelling. Facebook's Page comment takes `is_hidden`;
 * Instagram's is `POST /{ig-comment-id}?hide=<bool>`. Sending Facebook's
 * name to Instagram doesn't throw — the comment simply stays visible
 * while the desk records it as HIDDEN, which is the worst shape a bug
 * can take: moderation that reports success and does nothing. Hence the
 * platform argument, same as replyToComment above.
 */
export async function hideComment(
  platform: string,
  commentId: string,
  hide: boolean
): Promise<void> {
  const params: Record<string, string> =
    platform === "instagram" ? { hide: String(hide) } : { is_hidden: String(hide) };
  await graph(commentId, params, "POST");
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
/** Meta answered and refused. Distinct from never having heard back. */
export class GraphError extends Error {}

/**
 * A tappable link on an outbound reply.
 *
 * Three keys, deliberately. webview_height_ratio is documented as not
 * available on Instagram, and messenger_extensions is only for the
 * Extensions SDK, which would drag in domain whitelisting we otherwise
 * do not need. Neither is ever emitted, so one shape is correct on both
 * surfaces and the Instagram sender inherits that for free.
 */
export type ReplyButton = { title: string; url: string };

/**
 * The button template caps its own text far below a plain message.
 * chatbot.ts slices AI replies to 1900, which is legal as text and about
 * three times over this, so long copy has to give up the button rather
 * than give up half the sentence.
 */
const TEMPLATE_TEXT_MAX = 640;
/** Same 20-char rule quick-reply titles already follow. */
const BUTTON_TITLE_MAX = 20;
/**
 * Our own site or nothing. Not a Meta limit, a self-imposed one: a flow
 * row edited in the admin should never be able to turn the Page's
 * outbound DMs into a link farm.
 */
const BUTTON_HOST = /(^|\.)theheatchart\.com$/i;

function urlButton(b: ReplyButton): { type: "web_url"; url: string; title: string } | null {
  let u: URL;
  try {
    u = new URL(b.url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !BUTTON_HOST.test(u.hostname)) return null;
  const title = b.title.trim().slice(0, BUTTON_TITLE_MAX);
  if (!title) return null;
  return { type: "web_url", url: u.toString(), title };
}

/**
 * The one place an outbound DM's `message` field is shaped.
 *
 * text and attachment are MUTUALLY EXCLUSIVE on the Send API, so the
 * copy moves INTO the template rather than sitting beside it. Written as
 * a single ternary so that "both were set" is unrepresentable rather
 * than merely untested, which is the failure a future edit would
 * otherwise reintroduce by adding one more conditional assignment.
 *
 * Quick replies ride alongside either form; Meta documents them as
 * working with template attachments as well as plain text.
 *
 * Exported so the verify suite can hold the wire format to account
 * without a token or a network.
 */
export function buildDmMessage(
  text: string,
  quickReplies?: Array<{ label: string; payload: string }>,
  button?: ReplyButton
): Record<string, unknown> {
  const btn = button ? urlButton(button) : null;
  const message: Record<string, unknown> =
    btn && text.length <= TEMPLATE_TEXT_MAX
      ? {
          attachment: {
            type: "template",
            payload: { template_type: "button", text, buttons: [btn] },
          },
        }
      : { text };
  if (quickReplies && quickReplies.length > 0) {
    message.quick_replies = quickReplies.slice(0, 13).map((q) => ({
      content_type: "text",
      title: q.label.slice(0, 20),
      payload: q.payload,
    }));
  }
  return message;
}

export async function sendDmReply(
  recipientId: string,
  text: string,
  quickReplies?: Array<{ label: string; payload: string }>,
  sender: ReplySender = "automation",
  button?: ReplyButton
): Promise<void> {
  // The desk path is never templated: a real person typing gets the
  // plainest, strictest send there is, and one less thing that can be
  // refused between them and the customer.
  const wanted = sender === "human_agent" ? undefined : button;
  const message = buildDmMessage(text, quickReplies, wanted);
  const attached = "attachment" in message;
  const body = {
    recipient: JSON.stringify({ id: recipientId }),
    message: JSON.stringify(message),
  };
  if (sender !== "human_agent") {
    try {
      await graph("me/messages", { ...body, messaging_type: "RESPONSE" }, "POST");
    } catch (e) {
      // Only when Meta ANSWERED and refused, and only when a button was
      // what we added. A timeout means we never learned whether it
      // landed, and resending then double-messages a real person.
      if (!attached || !(e instanceof GraphError)) throw e;
      const plain = {
        recipient: body.recipient,
        message: JSON.stringify(buildDmMessage(text, quickReplies)),
      };
      await graph("me/messages", { ...plain, messaging_type: "RESPONSE" }, "POST");
    }
    return;
  }

  // The tag only works once the Human Agent feature is approved on the
  // app, which it isn't yet — so today the fallback below carries 100%
  // of desk replies. An earlier version gated the fallback on an
  // allowlist of refusal strings guessed from memory, which meant an
  // unrecognized refusal ("(#3) Application does not have the
  // capability…" matches none of them) would rethrow and the desk
  // couldn't reply to ANYONE, inside the window or not.
  //
  // The honest design needs no allowlist: on ANY tag failure, retry as
  // a plain RESPONSE — the strictest send there is, so the downgrade is
  // always policy-safe. If the window is genuinely closed or the token
  // is dead, the retry fails the same way and ITS error — accurate,
  // current, from the send that actually mattered — is what the desk
  // sees. Once Human Agent is approved, the first attempt just starts
  // succeeding. No redeploy, no string-matching Meta's error prose.
  try {
    await graph(
      "me/messages",
      { ...body, messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" },
      "POST"
    );
  } catch {
    await graph("me/messages", { ...body, messaging_type: "RESPONSE" }, "POST");
  }
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
  quickReplies?: Array<{ label: string; payload: string }>,
  button?: ReplyButton
): Promise<void> {
  const recipient = JSON.stringify({ comment_id: commentId });
  const message = buildDmMessage(text, quickReplies, button);
  try {
    await graph(
      "me/messages",
      { recipient, message: JSON.stringify(message) },
      "POST"
    );
  } catch (e) {
    // Same rule as sendDmReply: a refusal we can answer, a timeout we
    // cannot. This one matters more than most — Meta allows exactly ONE
    // private reply per comment, so a resend after a possible delivery
    // burns the only shot at that person.
    if (!("attachment" in message) || !(e instanceof GraphError)) throw e;
    await graph(
      "me/messages",
      { recipient, message: JSON.stringify(buildDmMessage(text, quickReplies)) },
      "POST"
    );
  }
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
