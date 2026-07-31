import { geminiConfigured, geminiJson, type GeminiPart } from "./gemini";
import { fetchPostContext } from "./metaEngage";

/**
 * What is this post, and what shoe is "number 2"? — answered by looking
 * at the post itself.
 *
 * The Page's engine post is a numbered collage: "which shoe, 1, 2 or
 * 3?". People answer "2", or "the bred ones", or "pip in ones", and a
 * reply that can't resolve that to an actual shoe reads like a bot
 * shaking hands with a stranger. The caption usually names the lineup;
 * when it doesn't, this asks Gemini to LOOK at the photo and read the
 * numbers/letters off the collage, identifying each shoe by sight.
 *
 * But not every post is a poll, and not every post is even about
 * shoes. A bot that answers "which one are you actually wearing" under
 * a post about somebody's birthday is worse than a bot that says
 * nothing. So the same call that reads the lineup also says what KIND
 * of post it is looking at, and writes one plain sentence about what
 * it's actually about. For an off-topic post that sentence is the only
 * thing the reply has to work with, which is exactly the point.
 *
 * Economics: this runs once per POST, not per comment — the brief is
 * cached, so a thousand comments on a viral poll cost one vision call.
 * Failure is always soft: no image, oversized image, refused call,
 * unparseable answer all yield null, and the reply falls back to
 * caption-only context, which already works.
 *
 * Request shape, doc-verified (2026-07): camelCase inlineData/mimeType
 * is the canonical proto3 JSON form — the API accepts both casings per
 * the protobuf JSON spec, and camelCase is what Google's official SDKs
 * emit on the wire (googleapis/js-genai converters). Image part BEFORE
 * text part is Google's stated best practice for single-image prompts.
 * Inline data counts against a 20MB total-request ceiling; the 6MB raw
 * cap here lands ~8MB after base64, comfortably under. Supported mime
 * types per the docs: jpeg, png, webp (plus heic/heif, which Meta's
 * CDN never serves us).
 */

/**
 * What the bot knows about a post before it answers anyone under it.
 *
 * `kind` decides which conversation it's in:
 *   poll         — labeled shoes, pick one. Comments are votes.
 *   photo-prompt — "post YOUR favorite pair". Comments carry photos.
 *   shoe-talk    — sneakers, but no lineup and no ask for photos.
 *   off-topic    — not about sneakers at all. Talk about the post.
 */
export type PostKind = "poll" | "photo-prompt" | "shoe-talk" | "off-topic";
export type PostBrief = {
  kind: PostKind;
  /** One plain sentence describing what the post is actually about. */
  topic: string | null;
  /** "1 = Air Jordan 4 Bred; 2 = Dunk Low Panda", polls only. */
  lineup: string | null;
};

const briefCache = new Map<string, { brief: PostBrief | null; at: number }>();
const LINEUP_TTL_MS = 12 * 60 * 60 * 1000;
const LINEUP_MAX = 300;
/** Inline payloads have a request-size ceiling; stay well under it. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const KINDS: PostKind[] = ["poll", "photo-prompt", "shoe-talk", "off-topic"];

const VISION_SYSTEM =
  'You read one social media post from a sneaker culture page and summarize what it IS, so a reply bot knows what conversation it is walking into. Answer ONLY with JSON: {"kind": "poll", "topic": "...", "shoes": [{"label": "1", "name": "Air Jordan 4 Bred"}]}\n\n' +
  'kind is exactly one of:\n' +
  '"poll" — two or more shoes labeled with numbers or letters, asking people to pick one.\n' +
  '"photo-prompt" — the post asks people to POST THEIR OWN photo in the comments: their favorite pair, their worst pair, their current rotation, what they just copped.\n' +
  '"shoe-talk" — about sneakers, but not a labeled poll and not asking for photos. One pair, a release, a question, a custom, a restock.\n' +
  '"off-topic" — not about sneakers at all. A holiday, a milestone, a meme, an announcement, anything else.\n\n' +
  'topic: ONE plain sentence naming what the post is actually about, specific enough that somebody who cannot see the post could hold a conversation about it. Name what is in the photo when the caption does not. For an off-topic post this sentence is the ONLY thing the bot will have, so make it concrete.\n\n' +
  'shoes: ONLY when kind is "poll". Label exactly as it appears in the image, name as the common model plus colorway. Use "unknown" as the name for a shoe you genuinely cannot identify. Use an empty array for every other kind.';

/**
 * The cached brief for a post. Null when there is nothing to read (no
 * caption, no image, no Gemini) or when the call failed — callers treat
 * null as "answer from the caption alone", which is what shipped before
 * any of this existed.
 */
export async function describePost(
  platform: string,
  postId: string | null
): Promise<PostBrief | null> {
  if (!postId || !geminiConfigured()) return null;
  const hit = briefCache.get(postId);
  if (hit && Date.now() - hit.at < LINEUP_TTL_MS) return hit.brief;

  let brief: PostBrief | null = null;
  try {
    const ctx = await fetchPostContext(platform, postId);
    // A text-only post still gets classified. The old version bailed
    // without an image, which meant every text post looked like a poll
    // to the reply prompt.
    if (ctx.text || ctx.imageUrl) {
      const parts: GeminiPart[] = [];
      if (ctx.imageUrl) {
        const img = await fetchImagePart(ctx.imageUrl);
        if (img) parts.push(img);
      }
      parts.push({
        text: ctx.text
          ? `The post caption says: "${ctx.text.slice(0, 900)}"`
          : "The post has no caption. Go by the image alone.",
      });
      const out = await geminiJson<{
        kind?: string;
        topic?: string;
        shoes?: Array<{ label?: string; name?: string }>;
      }>({ system: VISION_SYSTEM, parts, temperature: 0.2 });

      if (out) {
        const shoes = (out.shoes ?? []).filter(
          (s) => s.label && s.name && s.name.toLowerCase() !== "unknown"
        );
        const lineup =
          shoes.length > 0
            ? shoes.map((s) => `${String(s.label).toUpperCase()} = ${s.name}`).join("; ")
            : null;
        const raw = String(out.kind ?? "").toLowerCase().trim();
        // An unrecognised kind falls to shoe-talk rather than poll: the
        // poll frame is the one that reads badly when it's wrong.
        const kind: PostKind = (KINDS as string[]).includes(raw)
          ? (raw as PostKind)
          : lineup
            ? "poll"
            : "shoe-talk";
        const topic = typeof out.topic === "string" && out.topic.trim() ? out.topic.trim() : null;
        brief = { kind, topic: topic ? topic.slice(0, 300) : null, lineup };
      }
    }
  } catch {
    // Every failure is the same answer: we don't know what this post is.
  }

  if (briefCache.size >= LINEUP_MAX) {
    const oldest = briefCache.keys().next().value;
    if (oldest !== undefined) briefCache.delete(oldest);
  }
  briefCache.set(postId, { brief, at: Date.now() });
  return brief;
}

/**
 * Download an image and shape it as a Gemini inline part, or null if it
 * isn't one we can send: wrong type, empty, or over the inline ceiling.
 * Shared by the post read and the commenter-photo read.
 */
export async function fetchImagePart(
  url: string
): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
    return { inlineData: { mimeType: mime, data: buf.toString("base64") } };
  } catch {
    return null;
  }
}

/**
 * "1 = Air Jordan 4 Bred; 2 = Dunk Low Panda" — or null when there is
 * nothing to know. The string form is deliberate: it drops straight
 * into a prompt.
 */
export async function identifyPostShoes(
  platform: string,
  postId: string | null
): Promise<string | null> {
  return (await describePost(platform, postId))?.lineup ?? null;
}

/**
 * Deterministic vote parse — no model call, runs on EVERY comment.
 * "2", "b", "the 2s", "number two", or a shoe named outright ("the
 * breds") all resolve against the lineup when one is known. Returns
 * nulls rather than guessing: an opinion without a pick is still worth
 * banking.
 */
export function parseVoteChoice(
  text: string | null,
  lineup: string | null
): { label: string | null; shoe: string | null } {
  if (!text) return { label: null, shoe: null };
  const t = text.toLowerCase();

  const entries: Array<{ label: string; shoe: string }> = [];
  for (const part of (lineup ?? "").split(";")) {
    const m = part.trim().match(/^([a-z0-9]+)\s*=\s*(.+)$/i);
    if (m) entries.push({ label: m[1].toUpperCase(), shoe: m[2].trim() });
  }

  // A shoe named outright beats a stray digit — "jordan 4 all day"
  // contains a 4, and the 4 is part of the NAME, not a vote for row 4.
  for (const e of entries) {
    const words = e.shoe.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 0 && words.every((w) => t.includes(w))) {
      return { label: e.label, shoe: e.shoe };
    }
  }

  const wordNums: Record<string, string> = {
    one: "1", two: "2", three: "3", four: "4", five: "5", six: "6",
  };
  for (const [w, d] of Object.entries(wordNums)) {
    if (new RegExp(`\\b${w}s?\\b`).test(t)) {
      const hit = entries.find((e) => e.label === d);
      return { label: d, shoe: hit?.shoe ?? null };
    }
  }

  const m =
    t.match(/(?:^|\s|#)([1-9])(?:s\b|\b)/) ?? t.match(/(?:^|\s)([a-f])(?:\s|$|[.!?,])/i);
  if (m) {
    const label = m[1].toUpperCase();
    const hit = entries.find((e) => e.label === label);
    return { label, shoe: hit?.shoe ?? null };
  }

  return { label: null, shoe: null };
}
