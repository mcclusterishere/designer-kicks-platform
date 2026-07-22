import crypto from "crypto";
import { absoluteMediaUrl } from "./social";

/**
 * The instant channels — networks whose APIs hand out working keys in
 * minutes with no app review, unlike Meta:
 *
 *   X (Twitter)  X_CONSUMER_KEY + X_CONSUMER_SECRET +
 *                X_ACCESS_TOKEN + X_ACCESS_SECRET   (free tier, self-serve)
 *   Bluesky      BSKY_HANDLE + BSKY_APP_PASSWORD    (app password, zero review)
 *   Telegram     TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL  (@BotFather, 2 minutes)
 *   Discord      DISCORD_WEBHOOK_URL                (channel settings, 1 minute)
 *   Reddit       REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET +
 *                REDDIT_USERNAME + REDDIT_PASSWORD + REDDIT_SUBREDDIT
 *
 * Same dormant-until-key pattern as everything else: unconfigured
 * channels skip themselves and say so, so the admin Blast panel shows
 * exactly which pipes are live.
 */

export type BlastInput = {
  text: string;
  link: string;
  imageUrls: string[]; // up to 2 used per channel
};
export type BlastResult = { channel: string; ok: boolean; detail: string };

const skip = (channel: string): BlastResult => ({
  ok: false,
  channel,
  detail: "Not configured — see the keys runbook",
});
const fail = (channel: string, e: unknown): BlastResult => ({
  ok: false,
  channel,
  detail: e instanceof Error ? e.message : "failed",
});

async function fetchImage(url: string): Promise<{ bytes: Buffer; type: string }> {
  const res = await fetch(absoluteMediaUrl(url), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`image fetch ${res.status}`);
  return {
    bytes: Buffer.from(await res.arrayBuffer()),
    type: res.headers.get("content-type") ?? "image/jpeg",
  };
}

/* ---------------- X (Twitter) — OAuth 1.0a user context ---------------- */

export function xConfigured(): boolean {
  return Boolean(
    process.env.X_CONSUMER_KEY &&
      process.env.X_CONSUMER_SECRET &&
      process.env.X_ACCESS_TOKEN &&
      process.env.X_ACCESS_SECRET
  );
}

const pct = (s: string) =>
  encodeURIComponent(s).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function oauth1Header(method: string, url: string, extraParams: Record<string, string> = {}): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: process.env.X_CONSUMER_KEY!,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: process.env.X_ACCESS_TOKEN!,
    oauth_version: "1.0",
  };
  const all = { ...oauth, ...extraParams };
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${pct(k)}=${pct(all[k])}`)
    .join("&");
  const base = [method.toUpperCase(), pct(url), pct(paramString)].join("&");
  const key = `${pct(process.env.X_CONSUMER_SECRET!)}&${pct(process.env.X_ACCESS_SECRET!)}`;
  oauth.oauth_signature = crypto.createHmac("sha1", key).update(base).digest("base64");
  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((k) => `${pct(k)}="${pct(oauth[k])}"`)
      .join(", ")
  );
}

async function postToX(input: BlastInput): Promise<BlastResult> {
  if (!xConfigured()) return skip("X");
  try {
    // 1) Upload up to two photos (v1.1 accepts base64 form fields —
    //    signed WITHOUT the body param, since it's not query-encoded).
    const mediaIds: string[] = [];
    for (const url of input.imageUrls.slice(0, 2)) {
      const { bytes } = await fetchImage(url);
      const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
      const body = new URLSearchParams({ media_data: bytes.toString("base64") });
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: oauth1Header("POST", uploadUrl),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(30000),
      });
      const json = (await res.json().catch(() => ({}))) as { media_id_string?: string; errors?: { message: string }[] };
      if (!res.ok || !json.media_id_string) {
        throw new Error(json.errors?.[0]?.message ?? `media upload ${res.status}`);
      }
      mediaIds.push(json.media_id_string);
    }
    // 2) The tweet itself (v2, JSON body — OAuth1 header has no extra params).
    const tweetUrl = "https://api.twitter.com/2/tweets";
    const res = await fetch(tweetUrl, {
      method: "POST",
      headers: { Authorization: oauth1Header("POST", tweetUrl), "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `${input.text}\n\n${input.link}`,
        ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { id?: string }; detail?: string; title?: string };
    if (!res.ok || !json.data?.id) throw new Error(json.detail ?? json.title ?? `tweet ${res.status}`);
    return { channel: "X", ok: true, detail: "Posted" };
  } catch (e) {
    return fail("X", e);
  }
}

/* ---------------- Bluesky (AT Protocol) ---------------- */

export function blueskyConfigured(): boolean {
  return Boolean(process.env.BSKY_HANDLE && process.env.BSKY_APP_PASSWORD);
}

async function postToBluesky(input: BlastInput): Promise<BlastResult> {
  if (!blueskyConfigured()) return skip("Bluesky");
  try {
    const service = process.env.BSKY_SERVICE || "https://bsky.social";
    const sessRes = await fetch(`${service}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: process.env.BSKY_HANDLE,
        password: process.env.BSKY_APP_PASSWORD,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const sess = (await sessRes.json()) as { accessJwt?: string; did?: string; message?: string };
    if (!sess.accessJwt || !sess.did) throw new Error(sess.message ?? "auth failed");

    const images: { alt: string; image: unknown }[] = [];
    for (const url of input.imageUrls.slice(0, 2)) {
      const { bytes, type } = await fetchImage(url);
      const blobRes = await fetch(`${service}/xrpc/com.atproto.repo.uploadBlob`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sess.accessJwt}`, "Content-Type": type },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(30000),
      });
      const blob = (await blobRes.json()) as { blob?: unknown; message?: string };
      if (!blob.blob) throw new Error(blob.message ?? "blob upload failed");
      images.push({ alt: "Custom sneaker battle entrant", image: blob.blob });
    }

    const text = `${input.text}\n\n${input.link}`;
    // Make the link tappable: a facet over its byte range.
    const linkStart = Buffer.byteLength(`${input.text}\n\n`, "utf8");
    const record = {
      $type: "app.bsky.feed.post",
      text,
      createdAt: new Date().toISOString(),
      facets: [
        {
          index: { byteStart: linkStart, byteEnd: linkStart + Buffer.byteLength(input.link, "utf8") },
          features: [{ $type: "app.bsky.richtext.facet#link", uri: input.link }],
        },
      ],
      ...(images.length ? { embed: { $type: "app.bsky.embed.images", images } } : {}),
    };
    const postRes = await fetch(`${service}/xrpc/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sess.accessJwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ repo: sess.did, collection: "app.bsky.feed.post", record }),
      signal: AbortSignal.timeout(15000),
    });
    if (!postRes.ok) {
      const err = (await postRes.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message ?? `post ${postRes.status}`);
    }
    return { channel: "Bluesky", ok: true, detail: "Posted" };
  } catch (e) {
    return fail("Bluesky", e);
  }
}

/* ---------------- Telegram ---------------- */

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL);
}

async function postToTelegram(input: BlastInput): Promise<BlastResult> {
  if (!telegramConfigured()) return skip("Telegram");
  try {
    const api = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
    const chat_id = process.env.TELEGRAM_CHANNEL!;
    const caption = `${input.text}\n\n${input.link}`;
    const photos = input.imageUrls.slice(0, 2).map(absoluteMediaUrl);
    // Telegram fetches image URLs itself — no byte shuffling needed.
    const res =
      photos.length >= 2
        ? await fetch(`${api}/sendMediaGroup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id,
              media: photos.map((p, i) => ({ type: "photo", media: p, ...(i === 0 ? { caption } : {}) })),
            }),
            signal: AbortSignal.timeout(20000),
          })
        : await fetch(`${api}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id, photo: photos[0], caption }),
            signal: AbortSignal.timeout(20000),
          });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!json.ok) throw new Error(json.description ?? `telegram ${res.status}`);
    return { channel: "Telegram", ok: true, detail: "Posted to the channel" };
  } catch (e) {
    return fail("Telegram", e);
  }
}

/* ---------------- Discord ---------------- */

export function discordConfigured(): boolean {
  return Boolean(process.env.DISCORD_WEBHOOK_URL);
}

async function postToDiscord(input: BlastInput): Promise<BlastResult> {
  if (!discordConfigured()) return skip("Discord");
  try {
    const res = await fetch(process.env.DISCORD_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `${input.text}\n${input.link}`,
        embeds: input.imageUrls.slice(0, 2).map((u) => ({ image: { url: absoluteMediaUrl(u) } })),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`discord ${res.status}`);
    return { channel: "Discord", ok: true, detail: "Posted to the server" };
  } catch (e) {
    return fail("Discord", e);
  }
}

/* ---------------- Reddit (script app, password grant) ---------------- */

export function redditConfigured(): boolean {
  return Boolean(
    process.env.REDDIT_CLIENT_ID &&
      process.env.REDDIT_CLIENT_SECRET &&
      process.env.REDDIT_USERNAME &&
      process.env.REDDIT_PASSWORD &&
      process.env.REDDIT_SUBREDDIT
  );
}

async function postToReddit(input: BlastInput): Promise<BlastResult> {
  if (!redditConfigured()) return skip("Reddit");
  try {
    const ua = "TheHeatChart/1.0 (battle blast)";
    const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": ua,
      },
      body: new URLSearchParams({
        grant_type: "password",
        username: process.env.REDDIT_USERNAME!,
        password: process.env.REDDIT_PASSWORD!,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const token = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!token.access_token) throw new Error(token.error ?? "auth failed");
    // Link post: Reddit renders the battle page's OG card as the preview.
    const res = await fetch("https://oauth.reddit.com/api/submit", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": ua,
      },
      body: new URLSearchParams({
        sr: process.env.REDDIT_SUBREDDIT!,
        kind: "link",
        title: input.text.slice(0, 300),
        url: input.link,
        api_type: "json",
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as { json?: { errors?: unknown[][] } };
    if (!res.ok || (json.json?.errors?.length ?? 0) > 0) {
      throw new Error(String(json.json?.errors?.[0]?.[1] ?? `reddit ${res.status}`));
    }
    return { channel: "Reddit", ok: true, detail: `Posted to r/${process.env.REDDIT_SUBREDDIT}` };
  } catch (e) {
    return fail("Reddit", e);
  }
}

/* ---------------- the blast ---------------- */

export function instantChannelStatus(): { channel: string; configured: boolean }[] {
  return [
    { channel: "X", configured: xConfigured() },
    { channel: "Bluesky", configured: blueskyConfigured() },
    { channel: "Telegram", configured: telegramConfigured() },
    { channel: "Discord", configured: discordConfigured() },
    { channel: "Reddit", configured: redditConfigured() },
  ];
}

/** Fire every configured instant channel; nothing throws, all report. */
export async function blastEverywhere(input: BlastInput): Promise<BlastResult[]> {
  return Promise.all([
    postToX(input),
    postToBluesky(input),
    postToTelegram(input),
    postToDiscord(input),
    postToReddit(input),
  ]);
}
