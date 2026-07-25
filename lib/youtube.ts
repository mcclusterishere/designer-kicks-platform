import { prisma } from "./db";

/**
 * YouTube Shorts, from the clips artists already upload.
 *
 * Every approved piece can carry a fifteen-second clip, and a fifteen-second
 * vertical clip of somebody painting a shoe is exactly what Shorts rewards.
 * That content is already sitting in the database — this is the pipe to the
 * one platform where it has the most reach and the least competition.
 *
 * YouTube is the odd one out among our channels in three ways, and each one
 * shapes the code:
 *
 *  - It needs OAuth with a refresh token, not a static key. Google will only
 *    issue one after a human clicks through a consent screen, so there's a
 *    one-time connect flow and the token is stored rather than configured.
 *  - Upload is resumable: you open a session, then send the bytes. A single
 *    POST won't do it.
 *  - Quota is the real constraint. An upload costs 1,600 units against a
 *    default 10,000/day, so roughly six uploads a day is the ceiling no
 *    matter what the drip feed's pacing says. Worth knowing before wondering
 *    why the seventh failed.
 */

const REFRESH_KEY = "youtube_refresh_token";
const CHANNEL_KEY = "youtube_channel_title";

export const YT_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

export function youtubeOAuthConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
}

/** Connected = we hold a refresh token we can trade for access. */
export async function youtubeConnected(): Promise<boolean> {
  if (!youtubeOAuthConfigured()) return false;
  const row = await prisma.appSetting.findUnique({ where: { key: REFRESH_KEY } }).catch(() => null);
  return Boolean(row?.value);
}

export async function youtubeChannel(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: CHANNEL_KEY } }).catch(() => null);
  return row?.value ?? null;
}

export function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://theheatchart.com";
  return `${base.replace(/\/$/, "")}/api/youtube/callback`;
}

/**
 * The consent URL.
 *
 * access_type=offline and prompt=consent together are what make Google
 * return a refresh token. Without both you get an access token that expires
 * in an hour and no way to renew it, which is the single most common way
 * this integration is built wrong.
 */
export function consentUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: YT_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

/** Trade the one-time code for a refresh token and keep it. */
export async function exchangeCode(code: string): Promise<{ ok: boolean; detail: string }> {
  if (!youtubeOAuthConfigured()) return { ok: false, detail: "YouTube client ID/secret not set" };
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.YOUTUBE_CLIENT_ID!,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json()) as { refresh_token?: string; error_description?: string; error?: string };
    if (!json.refresh_token) {
      return {
        ok: false,
        detail:
          json.error_description ??
          json.error ??
          "Google returned no refresh token — revoke the app's access in your Google account and connect again.",
      };
    }
    await prisma.appSetting.upsert({
      where: { key: REFRESH_KEY },
      create: { key: REFRESH_KEY, value: json.refresh_token },
      update: { value: json.refresh_token },
    });
    await cacheChannelTitle().catch(() => {});
    return { ok: true, detail: "Connected." };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "exchange failed" };
  }
}

export async function disconnectYouTube(): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: { in: [REFRESH_KEY, CHANNEL_KEY] } } });
}

/** Short-lived access token, minted per use. Never stored. */
async function accessToken(): Promise<string | null> {
  if (!youtubeOAuthConfigured()) return null;
  const row = await prisma.appSetting.findUnique({ where: { key: REFRESH_KEY } }).catch(() => null);
  if (!row?.value) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: row.value,
        client_id: process.env.YOUTUBE_CLIENT_ID!,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

async function cacheChannelTitle(): Promise<void> {
  const token = await accessToken();
  if (!token) return;
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    items?: { snippet?: { title?: string } }[];
  };
  const title = json.items?.[0]?.snippet?.title;
  if (title) {
    await prisma.appSetting.upsert({
      where: { key: CHANNEL_KEY },
      create: { key: CHANNEL_KEY, value: title },
      update: { value: title },
    });
  }
}

export type UploadInput = {
  title: string;
  description: string;
  videoUrl: string;
  /** Extra tags beyond the defaults. */
  tags?: string[];
};

/**
 * Upload one Short.
 *
 * "#Shorts" in the description is what tells YouTube to treat a vertical
 * clip under a minute as a Short rather than a normal video — there's no API
 * field for it, which surprises people.
 *
 * Uploads are unlisted-then-public rather than straight to public: a bad
 * transcode or a wrong caption is far cheaper to catch on an unlisted URL
 * than on the channel feed. Flip privacyStatus below once the first few
 * land clean.
 */
export async function uploadShort(input: UploadInput): Promise<{ ok: boolean; detail: string }> {
  const token = await accessToken();
  if (!token) return { ok: false, detail: "YouTube not connected" };

  let bytes: Buffer;
  let contentType = "video/mp4";
  try {
    const res = await fetch(input.videoUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return { ok: false, detail: `couldn't fetch the clip (${res.status})` };
    contentType = res.headers.get("content-type") ?? contentType;
    bytes = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "clip fetch failed" };
  }
  if (bytes.length === 0) return { ok: false, detail: "clip was empty" };

  const metadata = {
    snippet: {
      title: input.title.slice(0, 100),
      description: `${input.description}\n\n#Shorts`.slice(0, 4900),
      tags: ["sneakers", "customsneakers", "sneakerart", ...(input.tags ?? [])].slice(0, 15),
      categoryId: "22", // People & Blogs — where maker/process content lives
    },
    status: {
      privacyStatus: "unlisted",
      selfDeclaredMadeForKids: false,
    },
  };

  try {
    // 1. Open a resumable session. Google answers with a URL to PUT to.
    const start = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Length": String(bytes.length),
          "X-Upload-Content-Type": contentType,
        },
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(20000),
      }
    );
    if (!start.ok) {
      const err = await start.text().catch(() => "");
      // 403 here is nearly always the daily quota, which is worth naming
      // rather than reporting as a generic refusal.
      const hint = start.status === 403 ? " (usually the daily upload quota — ~6/day on the default allowance)" : "";
      return { ok: false, detail: `session refused: ${start.status}${hint} ${err.slice(0, 200)}` };
    }
    const session = start.headers.get("location");
    if (!session) return { ok: false, detail: "no upload session URL returned" };

    // 2. Send the bytes.
    const put = await fetch(session, {
      method: "PUT",
      headers: { "Content-Type": contentType, "Content-Length": String(bytes.length) },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(180000),
    });
    const json = (await put.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!put.ok || !json.id) {
      return { ok: false, detail: json.error?.message ?? `upload failed (${put.status})` };
    }
    return { ok: true, detail: `https://youtube.com/shorts/${json.id} (unlisted)` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "upload failed" };
  }
}
