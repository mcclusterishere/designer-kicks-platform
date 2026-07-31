import { geminiConfigured, geminiJson } from "./gemini";
import { fetchPostContext } from "./metaEngage";

/**
 * What shoe is "number 2"? — answered by looking at the post.
 *
 * The Page's engine post is a numbered collage: "which shoe, 1, 2 or
 * 3?". People answer "2", or "the bred ones", or "pip in ones", and a
 * reply that can't resolve that to an actual shoe reads like a bot
 * shaking hands with a stranger. The caption usually names the lineup;
 * when it doesn't, this asks Gemini to LOOK at the photo and read the
 * numbers/letters off the collage, identifying each shoe by sight.
 *
 * Economics: identification runs once per POST, not per comment — the
 * lineup is cached, so a thousand comments on a viral poll cost one
 * vision call. Failure is always soft: no image, oversized image,
 * refused call, unparseable answer all yield null, and the reply falls
 * back to caption-only context, which already works.
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

const lineupCache = new Map<string, { lineup: string | null; at: number }>();
const LINEUP_TTL_MS = 12 * 60 * 60 * 1000;
const LINEUP_MAX = 300;
/** Inline payloads have a request-size ceiling; stay well under it. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const VISION_SYSTEM =
  "You identify sneakers in a social media poll image. The image shows one or more shoes, usually labeled with numbers (1, 2, 3) or letters (A, B, C), sometimes arranged in rows. Use the caption when it names them; use the image when it doesn't. Answer ONLY with JSON: {\"shoes\": [{\"label\": \"1\", \"name\": \"Air Jordan 4 Bred\"}]} — label as shown in the image, name as the commonly used model + colorway name. If you genuinely cannot identify a shoe, use \"unknown\" for its name. If the image has no labeled lineup at all, answer {\"shoes\": []}.";

/**
 * "1 = Air Jordan 4 Bred; 2 = Dunk Low Panda" — or null when there is
 * nothing to know. The string form is deliberate: it drops straight
 * into a prompt.
 */
export async function identifyPostShoes(
  platform: string,
  postId: string | null
): Promise<string | null> {
  if (!postId || !geminiConfigured()) return null;
  const hit = lineupCache.get(postId);
  if (hit && Date.now() - hit.at < LINEUP_TTL_MS) return hit.lineup;

  let lineup: string | null = null;
  try {
    const ctx = await fetchPostContext(platform, postId);
    if (ctx.imageUrl) {
      const res = await fetch(ctx.imageUrl, { signal: AbortSignal.timeout(15000) });
      const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
      if (res.ok && /^image\/(jpeg|png|webp)$/.test(mime)) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > 0 && buf.byteLength <= MAX_IMAGE_BYTES) {
          const out = await geminiJson<{ shoes?: Array<{ label?: string; name?: string }> }>({
            system: VISION_SYSTEM,
            parts: [
              { inlineData: { mimeType: mime, data: buf.toString("base64") } },
              {
                text: ctx.text
                  ? `The post caption says: "${ctx.text.slice(0, 600)}". Identify the labeled shoes.`
                  : "There is no caption. Identify the labeled shoes from the image alone.",
              },
            ],
            temperature: 0.2,
          });
          const shoes = (out?.shoes ?? []).filter(
            (s) => s.label && s.name && s.name.toLowerCase() !== "unknown"
          );
          if (shoes.length > 0) {
            lineup = shoes.map((s) => `${String(s.label).toUpperCase()} = ${s.name}`).join("; ");
          }
        }
      }
    }
  } catch {
    // Every failure is the same answer: we don't know the lineup.
  }

  if (lineupCache.size >= LINEUP_MAX) {
    const oldest = lineupCache.keys().next().value;
    if (oldest !== undefined) lineupCache.delete(oldest);
  }
  lineupCache.set(postId, { lineup, at: Date.now() });
  return lineup;
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
