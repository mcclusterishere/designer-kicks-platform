import { prisma } from "./db";
import { businessSecret, proofParams } from "./appsecret";
import { geminiChat, geminiConfigured } from "./gemini";
import {
  engageConfigured,
  replyToComment,
  sendDmReply,
  sendPrivateReply,
  type ParsedEvent,
} from "./metaEngage";

/**
 * The chat bot: the platform's own ManyChat, running on the webhook.
 *
 * The growth mechanic it exists for: a post says "comment HEAT and
 * I'll send you X". A thousand comments arrive. Each commenter gets
 * ONE private reply into their inbox (Meta's sanctioned comment-to-DM
 * door), written to earn an answer — because the private reply does
 * NOT open the 24-hour messaging window; only their answer does. Once
 * they answer, the flow graph takes over: every flow is a message with
 * tap buttons, every button points at another flow, and the admin
 * builds the graph as rows in a panel instead of paying $65/month for
 * a canvas.
 *
 * Routing order for an inbound DM, most-specific first:
 *   1. a quick-reply tap / postback / m.me ref  -> the flow it names
 *   2. the human-escalation words                -> hand off, go quiet
 *   3. a keyword match on message-trigger flows
 *   4. first-ever contact                        -> the welcome flow
 *   5. the default flow
 *   6. AI fallback (Gemini), if switched on
 *   7. silence — the Engagement desk still has the event
 *
 * Two lines this file will not cross, because Meta's platform terms
 * draw them: it never messages anyone who hasn't commented or written
 * first, and it always sends as RESPONSE inside the window. The
 * "outreach goes crazy" happens at the door (comments), not by
 * knocking on strangers' inboxes — there is no API that does that.
 */

/** AppSetting keys — one row each, edited from the admin panel. */
const ENABLED_KEY = "chatbotEnabled";
const AI_KEY = "chatbotAiFallback";
const PERSONA_KEY = "chatbotPersona";
const PUBLIC_KEY = "chatbotPublicReplies";
const COMMENT_STYLE_KEY = "chatbotCommentStyle";

/**
 * Public replies are the highest-volume, most-visible thing the bot
 * does, so they run under hard caps no setting can remove:
 *
 *   - at most one AI reply per commenter per day. A page that answers
 *     the same person's every comment reads as a machine cornering
 *     them, and repetitive bot interactions are exactly the engagement
 *     pattern Meta's spam systems score.
 *   - an hourly ceiling across all commenters. When the caps is hit,
 *     comments simply stay in the Engagement desk for humans — the
 *     failure mode is silence, never a flood.
 *
 * The ceiling is tunable (PUBLIC_REPLY_HOURLY_CAP) but never absent.
 */
const PUBLIC_REPLY_HOURLY_CAP = Math.max(
  1,
  Number(process.env.PUBLIC_REPLY_HOURLY_CAP || 30) || 30
);

export const DEFAULT_PERSONA =
  "You are the automated assistant for The Heat Chart (theheatchart.com), a custom-sneaker culture platform where artists post one-of-one customs, fans vote in battles, and the Heat List ranks the culture. Be brief, warm and hype — 1-3 sentences, no emojis walls. You are a bot and say so if asked. You help people find artists, enter the giveaway, play the games, or claim their artist page. If someone wants to buy, commission, or has a problem, tell them a real person will pick the thread up here shortly. Never invent prices or promises.";

export const DEFAULT_COMMENT_STYLE =
  "You reply PUBLICLY, as The Heat Chart's Facebook/Instagram page, to one comment on one of our posts. Sound like a person from sneaker culture, not a bot: 1-2 short sentences, casual, warm, zero hashtags, zero links, at most one emoji. Pick up something specific from THEIR comment and ask a question back that steers toward shoes, customs or fashion. Where it fits naturally (not every time), mention we run a free giveaway and they can DM us the word HEAT to get in. Never argue, never discuss politics/religion/anything sensitive, never make promises or prices. If the comment is hostile, spammy, an emergency, or you can't add anything genuine, reply with exactly the single word SKIP.";

export async function chatbotSettings(): Promise<{
  enabled: boolean;
  aiFallback: boolean;
  publicReplies: boolean;
  persona: string;
  commentStyle: string;
}> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [ENABLED_KEY, AI_KEY, PERSONA_KEY, PUBLIC_KEY, COMMENT_STYLE_KEY] } },
  });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    enabled: get(ENABLED_KEY) === "true",
    aiFallback: get(AI_KEY) === "true",
    publicReplies: get(PUBLIC_KEY) === "true",
    persona: get(PERSONA_KEY) || DEFAULT_PERSONA,
    commentStyle: get(COMMENT_STYLE_KEY) || DEFAULT_COMMENT_STYLE,
  };
}

export async function setChatbotSetting(
  key: "enabled" | "ai" | "persona" | "public" | "commentStyle",
  value: string
) {
  const k =
    key === "enabled" ? ENABLED_KEY
    : key === "ai" ? AI_KEY
    : key === "public" ? PUBLIC_KEY
    : key === "commentStyle" ? COMMENT_STYLE_KEY
    : PERSONA_KEY;
  await prisma.appSetting.upsert({
    where: { key: k },
    update: { value },
    create: { key: k, value },
  });
}

/* ------------------------------------------------------------------ */
/* Pure routing logic — the part the verify suite hammers              */
/* ------------------------------------------------------------------ */

export type FlowLite = {
  id: string;
  trigger: string;
  keywords: string[];
  postId: string | null;
  active: boolean;
};

/** Does this comment/message text hit this flow's keywords? */
export function keywordHit(keywords: string[], text: string | null): boolean {
  if (keywords.includes("*")) return true;
  if (!text) return false;
  const t = text.toLowerCase();
  return keywords.some((k) => k && t.includes(k.toLowerCase()));
}

/** Pick the flow a fresh COMMENT should trigger, specific post first. */
export function matchCommentFlow(flows: FlowLite[], text: string | null, postId: string | null): FlowLite | null {
  const candidates = flows.filter((f) => f.active && f.trigger === "comment");
  // A flow pinned to this exact post outranks a catch-all — that's how
  // "comment HEAT on THIS post" campaigns coexist with a general net.
  const pinned = candidates.filter((f) => f.postId && postId && postId.includes(f.postId));
  for (const pool of [pinned, candidates.filter((f) => !f.postId)]) {
    const hit = pool.find((f) => keywordHit(f.keywords, text));
    if (hit) return hit;
  }
  return null;
}

/** Pick the flow an inbound DM's TEXT should trigger. */
export function matchMessageFlow(flows: FlowLite[], text: string | null): FlowLite | null {
  return (
    flows.find((f) => f.active && f.trigger === "message" && keywordHit(f.keywords, text)) ?? null
  );
}

/** The escape hatch — these words always reach a human. */
export function wantsHuman(text: string | null): boolean {
  if (!text) return false;
  return /\b(human|real person|agent|somebody real|stop|unsubscribe)\b/i.test(text);
}

type QuickReply = { label: string; payload: string };

export function parseQuickReplies(raw: unknown): QuickReply[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((q): q is { label?: unknown; flowId?: unknown } => Boolean(q) && typeof q === "object")
    .map((q) => ({ label: String(q.label ?? ""), payload: `flow:${String(q.flowId ?? "")}` }))
    .filter((q) => q.label && q.payload !== "flow:");
}

/* ------------------------------------------------------------------ */
/* The runtime                                                         */
/* ------------------------------------------------------------------ */

async function contactFor(platform: string, psid: string, name: string | null) {
  const existing = await prisma.chatContact.findUnique({
    where: { platform_psid: { platform, psid } },
  });
  if (existing) {
    const updated = await prisma.chatContact.update({
      where: { id: existing.id },
      data: { lastInboundAt: new Date(), ...(name ? { name } : {}) },
    });
    return { contact: updated, isNew: false };
  }
  const created = await prisma.chatContact.create({
    data: { platform, psid, name, lastInboundAt: new Date() },
  });
  return { contact: created, isNew: true };
}

async function runFlow(
  contact: { id: string; psid: string },
  flowId: string
): Promise<boolean> {
  const flow = await prisma.chatFlow.findUnique({ where: { id: flowId } });
  if (!flow || !flow.active) return false;
  const buttons = parseQuickReplies(flow.quickReplies);
  await sendDmReply(contact.psid, flow.message, buttons);
  await prisma.chatMessage.create({
    data: { contactId: contact.id, direction: "out", text: flow.message, flowId: flow.id },
  });
  await prisma.chatContact.update({
    where: { id: contact.id },
    data: { lastFlowId: flow.id },
  });
  await prisma.chatFlow.update({ where: { id: flow.id }, data: { fired: { increment: 1 } } });
  return true;
}

/**
 * Route freshly stored webhook events through the bot. Returns the
 * objectIds it handled, so the older SocialRule layer can skip them
 * instead of double-answering.
 */
export async function runChatbot(events: ParsedEvent[]): Promise<Set<string>> {
  const handled = new Set<string>();
  if (events.length === 0 || !engageConfigured()) return handled;
  const settings = await chatbotSettings();
  if (!settings.enabled) return handled;

  const flows = await prisma.chatFlow.findMany({ where: { active: true } });

  for (const e of events) {
    try {
      if (e.kind === "comment") {
        const flow = matchCommentFlow(flows, e.text, e.parentId);
        if (!flow) {
          // No campaign claimed this comment — the conversational AI
          // gets a shot at it, under its own hard caps.
          await maybePublicAiReply(e, settings, handled);
          continue;
        }
        const full = flows.find((f) => f.id === flow.id)!;
        // The one private reply this comment will ever get. Buttons on
        // it are the reply-bait: a tap IS the answer that opens the
        // 24-hour window and hands the conversation to the flow graph.
        await sendPrivateReply(
          e.objectId,
          (full as { privateReply: string | null }).privateReply || full.message,
          parseQuickReplies(full.quickReplies)
        );
        await prisma.chatFlow.update({ where: { id: flow.id }, data: { fired: { increment: 1 } } });
        await prisma.metaEvent
          .update({
            where: { objectId: e.objectId },
            data: { autoNote: `bot: private reply via "${full.name}"`, status: "HANDLED" },
          })
          .catch(() => {});
        handled.add(e.objectId);
        continue;
      }

      if (e.kind !== "message" || !e.fromId) continue;

      const { contact, isNew } = await contactFor(e.platform, e.fromId, e.fromName);
      if (e.text || e.payload) {
        await prisma.chatMessage.create({
          data: {
            contactId: contact.id,
            direction: "in",
            text: e.text ?? `[${e.payload}]`,
          },
        });
      }

      // 1. A tapped button names its flow outright.
      const payloadFlow =
        e.payload?.startsWith("flow:") ? e.payload.slice(5)
        : e.payload?.startsWith("ref:") ? flows.find((f) => f.trigger === "message" && keywordHit(f.keywords, e.payload!.slice(4)))?.id ?? null
        : e.payload === "GET_STARTED" ? flows.find((f) => f.trigger === "welcome")?.id ?? null
        : e.payload ? flows.find((f) => f.id === e.payload)?.id ?? null
        : null;
      if (payloadFlow && (await runFlow(contact, payloadFlow))) {
        handled.add(e.objectId);
        continue;
      }

      // 2. Somebody asking for a person gets a person — the bot's one
      // non-negotiable manner. The event stays NEW for the desk.
      if (wantsHuman(e.text)) {
        await sendDmReply(
          contact.psid,
          "Got you — a real person from The Heat Chart will pick this up right here. Leave your question below."
        );
        await prisma.chatMessage.create({
          data: { contactId: contact.id, direction: "out", text: "[handed to human]", flowId: null },
        });
        handled.add(e.objectId);
        continue;
      }

      // 3. Keywords.
      const kw = matchMessageFlow(flows, e.text);
      if (kw && (await runFlow(contact, kw.id))) {
        handled.add(e.objectId);
        continue;
      }

      // 4. First contact -> welcome. 5. Otherwise the default net.
      const fallbackFlow = isNew
        ? flows.find((f) => f.trigger === "welcome") ?? flows.find((f) => f.trigger === "default")
        : flows.find((f) => f.trigger === "default");
      if (fallbackFlow && (await runFlow(contact, fallbackFlow.id))) {
        handled.add(e.objectId);
        continue;
      }

      // 6. The open half of the bot: Gemini answers in the site's
      // voice, with the recent transcript for context. Only when the
      // admin turned it on, and never for people who asked for a human
      // (they were caught above).
      if (settings.aiFallback && geminiConfigured() && e.text) {
        const recent = await prisma.chatMessage.findMany({
          where: { contactId: contact.id },
          orderBy: { createdAt: "desc" },
          take: 8,
        });
        const reply = await geminiChat({
          system: settings.persona,
          history: recent
            .reverse()
            .map((m) => ({ role: m.direction === "in" ? ("user" as const) : ("model" as const), text: m.text })),
          temperature: 0.5,
        });
        if (reply) {
          await sendDmReply(contact.psid, reply.slice(0, 1900));
          await prisma.chatMessage.create({
            data: { contactId: contact.id, direction: "out", text: reply.slice(0, 1900), flowId: "ai" },
          });
          await prisma.metaEvent
            .update({
              where: { objectId: e.objectId },
              data: { autoNote: "bot: AI answered", status: "HANDLED" },
            })
            .catch(() => {});
          handled.add(e.objectId);
        }
      }
      // 7. Nothing matched and AI is off — the Engagement desk shows
      // the message untouched. Silence beats a wrong answer.
    } catch (err) {
      console.error(`[chatbot] failed on ${e.objectId}:`, err);
    }
  }
  return handled;
}

/* ------------------------------------------------------------------ */
/* Public comment replies — the conversation starter                   */
/* ------------------------------------------------------------------ */

const PUBLIC_NOTE = "bot: public AI reply";

/**
 * Answer a comment IN PUBLIC, as the Page, in a way that starts a
 * conversation: pick something up from what they said, ask back,
 * steer to shoes, drop the giveaway where it fits. The private-reply
 * campaigns get first claim on a comment; this catches the rest.
 *
 * The caps are the feature. A page that answers a thousand comments
 * an hour with model output doesn't read as attentive, it reads as
 * infested — to people and to Meta's spam scoring alike. So: one AI
 * reply per commenter per day, a hard hourly ceiling, and a SKIP
 * escape the model is told to use on anything hostile or hollow.
 * Everything skipped stays NEW on the Engagement desk for humans.
 */
async function maybePublicAiReply(
  e: ParsedEvent,
  settings: { publicReplies: boolean; commentStyle: string },
  handled: Set<string>
): Promise<void> {
  if (!settings.publicReplies || !geminiConfigured()) return;
  if (!e.text || e.text.trim().length < 2) return;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Hard hourly ceiling across all commenters.
  const lastHour = await prisma.metaEvent.count({
    where: { autoNote: PUBLIC_NOTE, receivedAt: { gte: hourAgo } },
  });
  if (lastHour >= PUBLIC_REPLY_HOURLY_CAP) return;

  // One per person per day.
  if (e.fromId) {
    const already = await prisma.metaEvent.count({
      where: { fromId: e.fromId, autoNote: PUBLIC_NOTE, receivedAt: { gte: dayAgo } },
    });
    if (already > 0) return;
  }

  const reply = await geminiChat({
    system: settings.commentStyle,
    history: [
      {
        role: "user",
        text: `${e.fromName ? `${e.fromName} commented` : "A comment"} on our ${e.platform} post: "${e.text.slice(0, 500)}"`,
      },
    ],
    temperature: 0.8,
  });
  const clean = reply?.trim();
  if (!clean || /^skip\b/i.test(clean)) return;

  await replyToComment(e.platform, e.objectId, clean.slice(0, 280));
  await prisma.metaEvent
    .update({
      where: { objectId: e.objectId },
      data: { autoNote: PUBLIC_NOTE, status: "HANDLED" },
    })
    .catch(() => {});
  handled.add(e.objectId);
}

/* ------------------------------------------------------------------ */
/* Messenger Profile — the front door                                  */
/* ------------------------------------------------------------------ */

/**
 * Install the conversation's front door on the Page: the Get Started
 * button, the greeting above it, and up to four tap-to-ask ice
 * breakers — each one wired to a flow. This is the "pick your own
 * experience" onset: a new visitor sees the questions before they've
 * typed a word.
 */
export async function installMessengerProfile(opts: {
  greeting: string;
  iceBreakers: Array<{ question: string; flowId: string }>;
}): Promise<{ ok: boolean; detail: string }> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) return { ok: false, detail: "Page token not configured" };
  const FB_API = process.env.GRAPH_API_URL || "https://graph.facebook.com/v23.0";
  const body: Record<string, unknown> = {
    get_started: { payload: "GET_STARTED" },
    greeting: [{ locale: "default", text: opts.greeting.slice(0, 160) }],
  };
  if (opts.iceBreakers.length > 0) {
    body.ice_breakers = [
      {
        locale: "default",
        call_to_actions: opts.iceBreakers.slice(0, 4).map((b) => ({
          question: b.question.slice(0, 80),
          payload: `flow:${b.flowId}`,
        })),
      },
    ];
  }
  try {
    // Signed like every other Page call — this one edits the Page's
    // Messenger front door, so Require App Secret refuses it unsigned.
    const auth = new URLSearchParams({
      access_token: token,
      ...proofParams(token, businessSecret()),
    });
    const res = await fetch(`${FB_API}/me/messenger_profile?${auth}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok || json.error) {
      return { ok: false, detail: json.error?.message || `Messenger profile ${res.status}` };
    }
    return { ok: true, detail: "Front door installed — greeting, Get Started and openers are live." };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Messenger profile failed" };
  }
}
