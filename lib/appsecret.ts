import { createHmac } from "crypto";

/**
 * Signing Graph API calls so a stolen token is useless on its own.
 *
 * Meta lets an app demand that every server-to-server call carry an
 * `appsecret_proof` — an HMAC-SHA256 of the access token, keyed by the
 * app secret. The point is that access tokens are portable: lift one
 * out of a log line, a screenshot or a leaked env dump and it works
 * from anywhere. A proof binds the token to whoever also holds the app
 * secret, which never leaves the server.
 *
 * That matters here more than on a typical app. The Page token in this
 * system can post to a Page with a six-figure following, read every
 * DM, and moderate comments. Losing it is not a "rotate and move on"
 * event.
 *
 * WHICH SECRET SIGNS WHICH TOKEN
 *
 * The proof must use the app secret of the app that ISSUED the token,
 * and this platform runs three apps:
 *
 *   graph.facebook.com  Page tokens, house + editor  -> business app
 *   graph.instagram.com editors' own IG tokens       -> Instagram app
 *   graph.threads.net   Threads tokens               -> Threads app
 *
 * Sign with the wrong one and Meta rejects the call, so each caller
 * passes its own secret rather than reaching for a global.
 *
 * WHY IT DEGRADES INSTEAD OF THROWING
 *
 * When a secret isn't configured, no proof is attached and the call
 * goes out unsigned — which is exactly what happens today and works
 * fine, because "Require App Secret" is a per-app toggle that is off
 * until someone turns it on. This ordering is deliberate: the code has
 * to ship and be signing correctly BEFORE the toggle flips, or the
 * toggle takes production down. Belt first, then braces.
 *
 * Meta also documents a time-stamped variant (hashing
 * `token|unixtime` and sending `appsecret_time`), which expires after
 * five minutes. Not used here: it buys replay resistance we don't need
 * for server-to-server calls, and it fails on clock skew — a failure
 * mode that would be genuinely miserable to diagnose at 2am.
 */

/** The raw proof, or null when there's nothing to sign with. */
export function appsecretProof(accessToken: string, appSecret: string): string | null {
  if (!accessToken || !appSecret) return null;
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

/**
 * Proof as query/body params, ready to spread into a request. Empty
 * object when unconfigured, so call sites stay one-liners:
 *
 *   { ...params, access_token: t, ...proofParams(t, secret) }
 */
export function proofParams(
  accessToken: string,
  appSecret: string | undefined
): Record<string, string> {
  const proof = appsecretProof(accessToken, appSecret ?? "");
  return proof ? { appsecret_proof: proof } : {};
}

/**
 * The business app's secret — signs every graph.facebook.com token.
 *
 * This used to fall back to FACEBOOK_CLIENT_SECRET so a single-app dev
 * setup kept working. That fallback is now removed, because the fleet
 * split into separate apps and the two secrets stopped being
 * interchangeable: FACEBOOK_CLIENT_* belongs to the consumer LOGIN app,
 * while every Page token is issued by the BUSINESS app.
 *
 * Signing a business token with the login app's secret does not
 * degrade — it produces a perfectly well-formed proof that Meta
 * rejects with code 190 on every single call. That is indistinguishable
 * from an expired token at the call site, and lib/metaPublish.ts treats
 * code 190 as terminal and writes status EXPIRED onto connected
 * accounts. So the fallback could permanently retire every artist's
 * connection over a config typo, and reconnecting wouldn't fix it
 * because the next publish would re-sign with the same wrong key.
 *
 * Returning "" instead means unsigned, which fails honestly and
 * reversibly. Wrong-but-plausible is the worse failure.
 */
export function businessSecret(): string {
  return process.env.META_BUSINESS_APP_SECRET || "";
}
