import { prisma } from "./db";
import { absoluteMediaUrl } from "./social";
import { businessSecret, proofParams } from "./appsecret";

/**
 * Publishing to a channel somebody CONNECTED, with their token — as
 * opposed to lib/social.ts, which is the house Page on env-var tokens.
 *
 * Three providers, three different Meta APIs that refuse to be one:
 *
 *   instagram      graph.instagram.com   (Instagram-Login flavor: the
 *                  artist signs in with their IG, no Facebook Page
 *                  needed — the right flavor for creators)
 *   threads        graph.threads.net     (its own domain, its own app,
 *                  its own token family)
 *   facebook_page  graph.facebook.com    (a Page THEY admin; personal
 *                  profiles are not publishable by any app since 2018)
 *
 * Every function here takes the SocialAccount row, refreshes its token
 * if it's inside the renewal window (so no cron has to exist for tokens
 * to stay alive), publishes, and records the outcome ON the row — a
 * dead token flips status to EXPIRED once instead of failing silently
 * on every future piece.
 */

const IG_API = process.env.IG_USER_API_URL || "https://graph.instagram.com/v23.0";
const THREADS_API = process.env.THREADS_API_URL || "https://graph.threads.net/v1.0";
const FB_API = process.env.GRAPH_API_URL || "https://graph.facebook.com/v23.0";

/** Refresh when less than a week of the ~60-day token remains. */
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type PublishResult = { ok: boolean; detail: string };

type Account = {
  id: string;
  provider: string;
  accountId: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
};

/**
 * Which app secret signs a token, by the host it was minted against.
 * Getting this wrong makes Meta reject the call, so it's derived from
 * the provider rather than guessed.
 */
function secretFor(provider: string): string {
  if (provider === "instagram") return process.env.INSTAGRAM_APP_SECRET ?? "";
  if (provider === "threads") return process.env.THREADS_APP_SECRET ?? "";
  return businessSecret();
}

async function api(
  base: string,
  path: string,
  params: Record<string, string>,
  method: "GET" | "POST" = "POST",
  provider?: string
): Promise<Record<string, unknown>> {
  const token = params.access_token ?? "";
  const qs = new URLSearchParams({
    ...params,
    ...(provider && token ? proofParams(token, secretFor(provider)) : {}),
  });
  const url = method === "GET" ? `${base}/${path}?${qs}` : `${base}/${path}`;
  const res = await fetch(url, {
    method,
    ...(method === "POST" ? { body: qs } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number };
    [k: string]: unknown;
  };
  if (!res.ok || json.error) {
    const err = new Error(json.error?.message || `Meta API ${res.status}`);
    // Auth failures are terminal for the token, not transient — the
    // caller uses this to retire the account row instead of retrying.
    (err as Error & { authDead?: boolean }).authDead =
      json.error?.code === 190 || res.status === 401;
    throw err;
  }
  return json;
}

/**
 * Lazily refresh a long-lived token that's inside the renewal window.
 * IG and Threads both use the same shape: GET refresh_access_token with
 * a grant_type of their own naming. Facebook Page tokens derived from a
 * long-lived user token don't expire, so they skip this entirely.
 */
async function freshToken(acct: Account): Promise<string> {
  const needsRefresh =
    acct.tokenExpiresAt !== null &&
    acct.tokenExpiresAt.getTime() - Date.now() < REFRESH_WINDOW_MS;
  if (!needsRefresh || acct.provider === "facebook_page") return acct.accessToken;

  // Token endpoints live at the HOST ROOT — graph.instagram.com and
  // graph.threads.net take no /vX.Y prefix for refresh_access_token,
  // unlike the publishing edges.
  const base = (acct.provider === "threads" ? THREADS_API : IG_API).replace(/\/v[\d.]+$/, "");
  const grant = acct.provider === "threads" ? "th_refresh_token" : "ig_refresh_token";
  try {
    // Signs like every other call: the refresh edge carries an access
    // token, so Require App Secret rejects it unsigned — and because
    // the catch below swallows a failed refresh and returns the stale
    // token, an unsigned refresh would present as accounts quietly
    // dying at the 60-day mark with status still ACTIVE.
    const json = await api(
      base,
      "refresh_access_token",
      { grant_type: grant, access_token: acct.accessToken },
      "GET",
      acct.provider
    );
    const token = String(json.access_token ?? "");
    const seconds = Number(json.expires_in ?? 0);
    if (!token) return acct.accessToken;
    await prisma.socialAccount.update({
      where: { id: acct.id },
      data: {
        accessToken: token,
        tokenExpiresAt: seconds ? new Date(Date.now() + seconds * 1000) : null,
        lastRefreshedAt: new Date(),
        status: "ACTIVE",
      },
    });
    return token;
  } catch (e) {
    // A failed refresh isn't fatal — the current token may still have
    // days left, and the publish attempt is the real verdict. But a
    // SYSTEMATICALLY failing refresh (wrong secret, endpoint rejecting
    // the proof) would otherwise be invisible until tokens hard-expire
    // at day 60 and the whole fleet needs reconnecting — so it logs.
    console.error(
      `[metaPublish] token refresh failed for ${acct.provider}/${acct.id}:`,
      e instanceof Error ? e.message : e
    );
    return acct.accessToken;
  }
}

/** Poll a media container until Meta finishes ingesting it. */
async function waitForContainer(
  base: string,
  containerId: string,
  token: string,
  provider: string,
  tries = 12
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    const status = await api(
      base,
      containerId,
      { fields: "status_code", access_token: token },
      "GET",
      provider
    );
    if (status.status_code === "FINISHED") return true;
    if (status.status_code === "ERROR") return false;
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

/** Publish a photo or reel to the connected user's own Instagram. */
export async function publishToOwnInstagram(
  acct: Account,
  opts: { imageUrl?: string | null; videoUrl?: string | null; caption: string }
): Promise<PublishResult> {
  try {
    const token = await freshToken(acct);
    const container = opts.videoUrl
      ? await api(IG_API, `${acct.accountId}/media`, {
          media_type: "REELS",
          video_url: absoluteMediaUrl(opts.videoUrl),
          caption: opts.caption,
          access_token: token,
        }, "POST", "instagram")
      : await api(IG_API, `${acct.accountId}/media`, {
          image_url: absoluteMediaUrl(opts.imageUrl ?? ""),
          caption: opts.caption,
          access_token: token,
        }, "POST", "instagram");
    const creationId = String(container.id);
    // Videos need ingestion time; images are usually instant but the
    // status check is harmless and saves a race.
    if (opts.videoUrl && !(await waitForContainer(IG_API, creationId, token, "instagram"))) {
      return { ok: false, detail: "Instagram couldn't process the clip" };
    }
    await api(IG_API, `${acct.accountId}/media_publish`, {
      creation_id: creationId,
      access_token: token,
    }, "POST", "instagram");
    return { ok: true, detail: "Posted to their Instagram" };
  } catch (e) {
    return failed(acct, e);
  }
}

/** Publish to the connected user's own Threads profile. */
export async function publishToOwnThreads(
  acct: Account,
  opts: { text: string; imageUrl?: string | null }
): Promise<PublishResult> {
  try {
    const token = await freshToken(acct);
    const params: Record<string, string> = opts.imageUrl
      ? { media_type: "IMAGE", image_url: absoluteMediaUrl(opts.imageUrl), text: opts.text, access_token: token }
      : { media_type: "TEXT", text: opts.text, access_token: token };
    const container = await api(THREADS_API, `${acct.accountId}/threads`, params, "POST", "threads");
    const creationId = String(container.id);
    if (opts.imageUrl && !(await waitForContainer(THREADS_API, creationId, token, "threads"))) {
      return { ok: false, detail: "Threads couldn't process the image" };
    }
    await api(THREADS_API, `${acct.accountId}/threads_publish`, {
      creation_id: creationId,
      access_token: token,
    }, "POST", "threads");
    return { ok: true, detail: "Posted to their Threads" };
  } catch (e) {
    return failed(acct, e);
  }
}

/** Publish to a Facebook Page the connected user admins. */
export async function publishToOwnFacebookPage(
  acct: Account,
  opts: { message: string; imageUrl?: string | null; link?: string | null }
): Promise<PublishResult> {
  try {
    const token = await freshToken(acct);
    if (opts.imageUrl) {
      await api(FB_API, `${acct.accountId}/photos`, {
        url: absoluteMediaUrl(opts.imageUrl),
        caption: opts.link ? `${opts.message}\n\n${opts.link}` : opts.message,
        access_token: token,
      }, "POST", "facebook_page");
    } else {
      await api(FB_API, `${acct.accountId}/feed`, {
        message: opts.message,
        ...(opts.link ? { link: opts.link } : {}),
        access_token: token,
      }, "POST", "facebook_page");
    }
    return { ok: true, detail: "Posted to their Facebook Page" };
  } catch (e) {
    return failed(acct, e);
  }
}

/**
 * Record a publish failure on the account row. An auth-dead token
 * retires the connection so the channels card shows "reconnect" instead
 * of the platform quietly dropping every future post.
 */
async function failed(acct: Account, e: unknown): Promise<PublishResult> {
  const detail = e instanceof Error ? e.message : "Publish failed";
  const authDead = Boolean((e as { authDead?: boolean })?.authDead);
  await prisma.socialAccount
    .update({
      where: { id: acct.id },
      data: { lastError: detail, ...(authDead ? { status: "EXPIRED" } : {}) },
    })
    .catch(() => {});
  return { ok: false, detail };
}

/** Route a piece to the right publisher for one connected account. */
export async function publishPieceToAccount(
  acct: Account & { handle: string | null },
  piece: { caption: string; imageUrl: string; videoUrl: string | null; link: string }
): Promise<PublishResult> {
  if (acct.provider === "instagram") {
    return publishToOwnInstagram(acct, {
      imageUrl: piece.imageUrl,
      videoUrl: piece.videoUrl,
      caption: piece.caption,
    });
  }
  if (acct.provider === "threads") {
    // Threads counts the link against the 500-char cap; the caption
    // builder already left room.
    return publishToOwnThreads(acct, {
      text: `${piece.caption}\n\n${piece.link}`,
      imageUrl: piece.imageUrl,
    });
  }
  if (acct.provider === "facebook_page") {
    return publishToOwnFacebookPage(acct, {
      message: piece.caption,
      imageUrl: piece.imageUrl,
      link: piece.link,
    });
  }
  return { ok: false, detail: `Unknown provider ${acct.provider}` };
}
