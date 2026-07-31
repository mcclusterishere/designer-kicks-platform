import { prisma } from "./db";
import { businessSecret, proofParams } from "./appsecret";
import { geminiChat, geminiConfigured } from "./gemini";
import {
  engageConfigured,
  likeObject,
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
const GIF_LIBRARY_KEY = "chatbotGifLibrary";

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

/**
 * Strip the tells that make a reply read as machine-written.
 *
 * Asking a model not to use em dashes works most of the time, which is
 * the problem — "most of the time" on a page this size is still several
 * a week, in public, under our own name. Prompts are a preference;
 * this is the guarantee. Runs on every outbound AI reply, public or DM.
 *
 * Em and en dashes become commas, because in the one-or-two-sentence
 * replies this thing writes, that's what the dash was standing in for.
 * Nothing else about the sentence changes.
 */
export function humanize(text: string): string {
  return (
    text
      // Dashes become commas — EXCEPT between digits, where the dash is
      // a range ("sizes 9–11", "5–7 business days") and a comma would
      // change what the sentence claims.
      .replace(/(?<![0-9])[^\S\n]*[—–][^\S\n]*(?![0-9])/g, ", ")
      // Semicolons splicing clauses become commas; a semicolon glued to
      // the next char is an emoticon ;) and stays.
      .replace(/[^\S\n]*;[^\S\n]+(?=[A-Za-z])/g, ", ")
      .replace(/,[^\S\n]*,/g, ",")
      // Collapse runs of spaces but never newlines — a DM's paragraph
      // break is formatting, not sloppiness.
      .replace(/[^\S\n]{2,}/g, " ")
      .replace(/[^\S\n]+([.,!?])/g, "$1")
      // A reply that OPENED with a dash leaves a leading comma behind.
      .replace(/^[,\s]+/, "")
      .trim()
  );
}

/**
 * The GIF library: `tag  url` lines the admin curates in the Chatbot
 * panel. The model asks for a mood by tag; the code decides whether a
 * real URL backs it. Shipped EMPTY on purpose — a broken image under
 * the Page's name is worse than no GIF, and no URL goes in this file
 * that nobody has watched actually load.
 */
export function parseGifLibrary(raw: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of (raw ?? "").split("\n")) {
    const m = line.trim().match(/^(\S+)\s+(https?:\/\/\S+)$/);
    if (m) out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

/**
 * Pull a trailing [gif:tag] request out of a reply. The tag is the
 * model's mood vote, not a URL — it only becomes an attachment when the
 * admin's library has that tag, and it's stripped from the text either
 * way so an unstocked library never leaks bracket syntax to the public.
 */
export function extractGif(
  reply: string,
  library: Record<string, string>
): { text: string; gifUrl: string | null } {
  const m = reply.match(/\[\s*gif\s*:\s*([a-z0-9_-]+)\s*\]/i);
  if (!m) return { text: reply.trim(), gifUrl: null };
  const text = reply.replace(m[0], "").replace(/\s{2,}/g, " ").trim();
  return { text, gifUrl: library[m[1].toLowerCase()] ?? null };
}

export const DEFAULT_PERSONA =
  "You are the automated assistant for The Heat Chart (theheatchart.com), a custom-sneaker culture platform where artists post one-of-one customs, fans vote in battles, and the Heat List ranks the culture. Be brief, warm and hype — 1-3 sentences, no emoji walls. You are a bot and say so if asked. You help people find artists, enter the giveaway, play the games, or claim their artist page. When someone lands here after voting or commenting on one of our polls, THANK THEM for the vote first — their pick is why the page works. Then, once and naturally, mention we run a random apparel giveaway: never name specific items or brands, just 'apparel'. Entering is free — make an account at theheatchart.com, and logging in day after day builds a streak that keeps you in the running. Never invent prices, odds, deadlines or promises. If someone wants to buy, commission, or has a problem, tell them a real person will pick the thread up here shortly.";

export const DEFAULT_COMMENT_STYLE =
  "You reply PUBLICLY, as The Heat Chart's Facebook/Instagram page, to one comment on one of our posts. Sound like a person from sneaker culture, not a bot: 1-2 short sentences, casual, warm, zero hashtags, zero links, at most one emoji. Never argue, never discuss politics/religion/anything sensitive, never make promises or prices. If the comment is hostile, spammy, an emergency, or you can't add anything genuine, reply with exactly the single word SKIP.\n\nREAD THE POST FIRST. You'll be shown what our post said. Most of our posts are picks: 'which shoe, 1/2/3' or 'which row, A/B/C'. When their comment is a pick ('2', 'B', 'the red ones', 'bottom left'), work out which shoe they chose from the post text, and if the post names it, use the actual name, 'the Jordan 4s', not 'option 2'. React to THEIR pick like you have an opinion about it too, then ask ONE question back.\n\nMULTI-VOTERS: when the post says pick ONE and they picked several ('1 and 3', 'A and C', 'all of them', 'can't choose'), call it out playfully, that's cheating and they know it: 'nah you can't take all three lol, pick ONE' or 'that's cheating and you know it 😂 which one are you actually wearing'. ALWAYS soften the callout with lol or 😂 so it reads as a joke, never as actual annoyance, and never insult THEM, only the greedy vote. Then make them commit: if they could only keep one, which one.\n\nROTATE YOUR QUESTIONS, don't repeat the same angle down a thread. Angles to draw from: did they ever own a pair, and what happened to it. Would they actually buy it now or does it just photograph well. Style or storyline, do they rock it for the look or the history. What they'd wear it with. On-foot or on-display. Is the colorway the right one or is there a better make-up. Worth retail, worth resale, or worth neither. Did they have the original run or the retro. Would they let someone customize a pair or keep it stock. Which of the OTHER options in the post came second for them. First pair they ever loved. The one that got away.\n\nWhere it fits naturally (not every time), mention we run a random apparel giveaway — free to enter by making an account at theheatchart.com. Say the site name in plain words; the zero-links rule still holds. Never name specific giveaway items or brands, just 'apparel'.\n\nHOW TO SOUND: dry and a little funny beats enthusiastic. React like someone who actually looked at the shoe. Specific over general, 'that midsole paint is clean' lands, 'so cool!' does not. Never open with Ah, Oh, Wow, Absolutely, Great question, or Love this. Never use em dashes or semicolons; short sentences instead. Never say 'we're thrilled', 'amazing', 'incredible', 'let's dive in', or 'reach out'. Contractions always. It's fine to be a little blunt. Do not compliment someone's taste and then pivot to a sales line in the same breath, pick one. Disagreeing with their pick occasionally is good, one playful line, never mean, and only about the shoe.\n\nGIF: if a reaction GIF would genuinely land, end the reply with [gif:tag] where tag is one word for the mood: fire, respect, thinking, sheesh, cold, classic, nah, crying, chef-kiss. Use one at most, and only on maybe one reply in four. The text must stand on its own without it.";

export async function chatbotSettings(): Promise<{
  enabled: boolean;
  aiFallback: boolean;
  publicReplies: boolean;
  persona: string;
  commentStyle: string;
  gifLibrary: string;
}> {
  const rows = await prisma.appSetting.findMany({
    where: {
      key: { in: [ENABLED_KEY, AI_KEY, PERSONA_KEY, PUBLIC_KEY, COMMENT_STYLE_KEY, GIF_LIBRARY_KEY] },
    },
  });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    enabled: get(ENABLED_KEY) === "true",
    aiFallback: get(AI_KEY) === "true",
    publicReplies: get(PUBLIC_KEY) === "true",
    persona: get(PERSONA_KEY) || DEFAULT_PERSONA,
    commentStyle: get(COMMENT_STYLE_KEY) || DEFAULT_COMMENT_STYLE,
    gifLibrary: get(GIF_LIBRARY_KEY) || "",
  };
}

export async function setChatbotSetting(
  key: "enabled" | "ai" | "persona" | "public" | "commentStyle" | "gifs",
  value: string
) {
  const k =
    key === "enabled" ? ENABLED_KEY
    : key === "ai" ? AI_KEY
    : key === "public" ? PUBLIC_KEY
    : key === "commentStyle" ? COMMENT_STYLE_KEY
    : key === "gifs" ? GIF_LIBRARY_KEY
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
      if (e.kind === "share") {
        await maybeThankShare(e, settings, handled);
        continue;
      }
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
          // One value, sent and stored: the transcript is the desk's
          // memory AND Gemini's next-turn history, so storing the raw
          // text would show the model its own em-dash style as accepted
          // prior turns and quietly teach it back.
          const sent = humanize(reply).slice(0, 1900);
          await sendDmReply(contact.psid, sent);
          await prisma.chatMessage.create({
            data: { contactId: contact.id, direction: "out", text: sent, flowId: "ai" },
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
  settings: { publicReplies: boolean; commentStyle: string; gifLibrary: string },
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

  // What OUR post said is what turns "2" from noise into a vote. A
  // failed fetch degrades to the old contextless behavior rather than
  // costing the reply.
  const { fetchPostContext } = await import("./metaEngage");
  const postText = await fetchPostContext(e.platform, e.parentId ?? null);

  const reply = await geminiChat({
    system: settings.commentStyle,
    history: [
      {
        role: "user",
        text: [
          postText ? `Our ${e.platform} post says: "${postText.slice(0, 600)}"` : null,
          `${e.fromName ? `${e.fromName} commented` : "A comment"}: "${e.text.slice(0, 500)}"`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    temperature: 0.8,
  });
  if (!reply) return;

  // The gif tag comes out before humanize so the bracket syntax never
  // reaches the dash cleanup, and the tag only becomes an attachment
  // when the admin's library actually stocks it.
  const { text: bare, gifUrl } = extractGif(reply, parseGifLibrary(settings.gifLibrary));
  const clean = humanize(bare);
  if (!clean || /^skip\b/i.test(clean)) return;

  await replyToComment(e.platform, e.objectId, clean.slice(0, 280), gifUrl);
  await prisma.metaEvent
    .update({
      where: { objectId: e.objectId },
      data: { autoNote: PUBLIC_NOTE, status: "HANDLED" },
    })
    .catch(() => {});
  handled.add(e.objectId);
}

const SHARE_NOTE = "auto-share-thanks";
const SHARE_LIKE_NOTE = "auto-liked share";
const SHARE_THANKS_HOURLY_CAP = Math.max(
  1,
  Number(process.env.SHARE_THANKS_HOURLY_CAP || 12) || 12
);

const SHARE_THANKS_STYLE =
  "Someone just SHARED one of The Heat Chart's posts to their own Facebook. You're commenting a thank-you on THEIR share, as the page. You are a guest on their wall: 1-2 short sentences, warm, zero links, zero hashtags, at most one emoji, no selling, do not mention the giveaway. If they wrote a caption, react to what THEY said — their take is the whole point. If their caption is hostile, political, sensitive, or you can't add anything genuine, reply with exactly the single word SKIP. Never use em dashes or semicolons. Never open with Ah, Oh, Wow, or Love this.";

/**
 * Someone put our post on their wall. The full gesture is like +
 * thank-you comment; privacy decides how much of it lands, and every
 * refusal is an answer rather than an error:
 *
 *   like fails        → their share isn't visible to us. Done, quietly.
 *   caption unreadable → can't read the room, so don't speak in it.
 *                        The like stands alone.
 *   comment refused   → comments off, or walled. The like stands.
 *
 * Same discipline as public replies: hard hourly cap, one thank-you
 * per sharer per day, and the model can decline. A thank-you that
 * shows up on every share within seconds reads as a machine — the
 * caps are what keep it reading as a page that noticed.
 */
async function maybeThankShare(
  e: ParsedEvent,
  settings: { publicReplies: boolean; gifLibrary: string },
  handled: Set<string>
): Promise<void> {
  if (!settings.publicReplies) return;
  if (e.platform !== "facebook") return;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // The cap bounds EVERY automated touch on shares, likes included — a
  // wall of instant likes reads as a machine just like comments do.
  const lastHour = await prisma.metaEvent.count({
    where: { autoNote: { in: [SHARE_NOTE, SHARE_LIKE_NOTE] }, receivedAt: { gte: hourAgo } },
  });
  if (lastHour >= SHARE_THANKS_HOURLY_CAP) return;
  if (e.fromId) {
    const already = await prisma.metaEvent.count({
      where: {
        fromId: e.fromId,
        autoNote: { in: [SHARE_NOTE, SHARE_LIKE_NOTE] },
        receivedAt: { gte: dayAgo },
      },
    });
    if (already > 0) return;
  }

  // The like leads. It's the one move privacy can't make embarrassing,
  // and if even that is refused the share isn't ours to touch.
  const liked = await likeObject(e.objectId);
  if (!liked) return;

  let note: string = SHARE_LIKE_NOTE;
  // Their caption: sometimes on the webhook, otherwise fetched. Both
  // empty means we can't read their wall — so we don't talk on it.
  const { fetchPostContext } = await import("./metaEngage");
  const caption = e.text || (await fetchPostContext("facebook", e.objectId));
  if (caption && geminiConfigured()) {
    const reply = await geminiChat({
      system: SHARE_THANKS_STYLE,
      history: [
        {
          role: "user",
          text: `${e.fromName ? `${e.fromName} shared` : "Someone shared"} our post with this caption: "${caption.slice(0, 500)}"`,
        },
      ],
      temperature: 0.8,
    });
    const clean = reply ? humanize(reply) : "";
    if (clean && !/^skip\b/i.test(clean)) {
      try {
        await replyToComment("facebook", e.objectId, clean.slice(0, 280));
        note = SHARE_NOTE;
      } catch {
        // Comments closed on their share. The like already said it.
      }
    }
  }

  await prisma.metaEvent
    .update({ where: { objectId: e.objectId }, data: { autoNote: note, status: "HANDLED" } })
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
