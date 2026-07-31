/**
 * m.me links: the only sanctioned door left from a post into Messenger.
 *
 * The Customer Chat Plugin that used to do this on websites was fully
 * deprecated in 2024, so this is what remains, and it is better anyway:
 * a link in a caption carries a `ref` that arrives on the webhook, which
 * means the bot opens already knowing which battle, drop or giveaway the
 * person came from. Without it, every DM the funnel produces is
 * anonymous and nothing downstream can be attributed to a post.
 *
 * The webhook side is already built. parseWebhookPayload reads
 * referral.ref on a fresh conversation and postback.referral mid-thread,
 * and hands it to the router as `ref:<value>`.
 *
 * SOURCING: Meta documents the parameter as "a string up to 2,083
 * characters". The set of ALLOWED characters is not published anywhere
 * reachable, so this restricts to an alphabet that is unambiguous in a
 * URL and in a webhook payload. Being stricter than Meta cannot break a
 * link; guessing looser could.
 */

/** Conservative by choice: letters, digits, and three separators. */
const REF_SAFE = /[^A-Za-z0-9_.-]/g;
/** Meta's documented ceiling is 2083. Nothing we generate is near it. */
const REF_MAX = 200;

/**
 * The Page's m.me handle. A username is what people see, but the numeric
 * Page id also resolves, so the id is the fallback rather than an error:
 * a missing vanity name should not silently disable attribution.
 */
function pageHandle(): string | null {
  return process.env.FB_PAGE_USERNAME || process.env.FB_PAGE_ID || null;
}

/** "battle_42" from ("battle", 42). Empty parts are dropped, not encoded as blanks. */
export function refFor(kind: string, id?: string | number | null): string {
  const parts = [kind, id == null ? "" : String(id)].filter(Boolean);
  return parts
    .join("_")
    .replace(REF_SAFE, "")
    .slice(0, REF_MAX)
    .replace(/^_+|_+$/g, "");
}

/**
 * A tracked door into the Page's inbox, or null when there is no Page
 * configured. Null rather than a broken link: a caption with a dead
 * m.me in it is worse than a caption without one.
 */
export function mmeLink(kind: string, id?: string | number | null): string | null {
  const handle = pageHandle();
  if (!handle) return null;
  const ref = refFor(kind, id);
  return ref ? `https://m.me/${handle}?ref=${ref}` : `https://m.me/${handle}`;
}

/**
 * What the ref meant, on the way back in. The router hands us the raw
 * value from the webhook; this splits it into the kind and the id so a
 * flow can open on the right battle.
 */
export function parseRef(raw: string | null | undefined): { kind: string; id: string | null } | null {
  const t = (raw ?? "").trim().replace(REF_SAFE, "");
  if (!t) return null;
  const i = t.indexOf("_");
  if (i === -1) return { kind: t, id: null };
  return { kind: t.slice(0, i), id: t.slice(i + 1) || null };
}
