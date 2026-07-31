import { siteUrl } from "./articles";
import { businessSecret, proofParams } from "./appsecret";

/**
 * Cross-posting to Matt's own pages via the Meta Graph API.
 *
 * Facebook Page posts need: FB_PAGE_ID + FB_PAGE_ACCESS_TOKEN (a
 * long-lived Page token with pages_manage_posts).
 * Instagram posts need: IG_USER_ID (the IG Business account linked to
 * that Page) + the same token carrying instagram_content_publish.
 * IG can only publish photos through the API, and the photo URL must
 * be publicly reachable — production uploads qualify, localhost never.
 *
 * Unconfigured channels report themselves cleanly so the Broadcast
 * composer can fall back to copy-paste.
 */

// GRAPH_API_URL override exists for tests (a local mock stands in for
// Meta) — production always talks to the real Graph API.
// v23.0 to match metaEngage, metaPublish, metaConnect and chatbot. This
// file sat on v21.0 while everything else moved, so the same process
// spoke two Graph versions — harmless until v21 reaches end of life, at
// which point house Page and IG posting would break while connected
// editors' publishing kept working, presenting as a token fault.
const GRAPH = process.env.GRAPH_API_URL || "https://graph.facebook.com/v23.0";

export type SocialResult = { ok: boolean; detail: string };

export function facebookConfigured(): boolean {
  return Boolean(process.env.FB_PAGE_ID && process.env.FB_PAGE_ACCESS_TOKEN);
}

export function instagramConfigured(): boolean {
  return Boolean(process.env.IG_USER_ID && process.env.FB_PAGE_ACCESS_TOKEN);
}

/** "/api/uploads/x.webp" → absolute URL Meta's fetchers can reach. */
export function absoluteMediaUrl(url: string): string {
  return url.startsWith("http") ? url : `${siteUrl()}${url}`;
}

async function graphPost(
  path: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN ?? "";
  const body = new URLSearchParams({
    ...params,
    access_token: token,
    ...proofParams(token, businessSecret()),
  });
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    [k: string]: unknown;
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Graph API ${res.status}`);
  }
  return json;
}

export async function postToFacebookPage(
  message: string,
  opts: { imageUrl?: string | null; link?: string | null } = {}
): Promise<SocialResult> {
  if (!facebookConfigured()) return { ok: false, detail: "Facebook not connected" };
  try {
    const pageId = process.env.FB_PAGE_ID!;
    if (opts.imageUrl) {
      await graphPost(`${pageId}/photos`, {
        url: absoluteMediaUrl(opts.imageUrl),
        caption: opts.link ? `${message}\n\n${opts.link}` : message,
      });
    } else {
      await graphPost(`${pageId}/feed`, {
        message,
        ...(opts.link ? { link: opts.link } : {}),
      });
    }
    return { ok: true, detail: "Posted to the Facebook page" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Facebook post failed" };
  }
}

/**
 * Page video post. Unlike photos, Graph video uploads go through the
 * same /{page}/videos edge with a file_url Meta pulls itself — so the
 * clip URL must be publicly reachable, same rule as IG photos.
 */
export async function postToFacebookVideo(
  videoUrl: string,
  description: string
): Promise<SocialResult> {
  if (!facebookConfigured()) return { ok: false, detail: "Facebook not connected" };
  try {
    await graphPost(`${process.env.FB_PAGE_ID!}/videos`, {
      file_url: absoluteMediaUrl(videoUrl),
      description,
    });
    return { ok: true, detail: "Video posted to the Facebook page" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Facebook video failed" };
  }
}

async function graphGet(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN ?? "";
  const qs = new URLSearchParams({
    ...params,
    access_token: token,
    ...proofParams(token, businessSecret()),
  });
  const res = await fetch(`${GRAPH}/${path}?${qs}`, { signal: AbortSignal.timeout(15000) });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    [k: string]: unknown;
  };
  if (!res.ok || json.error) throw new Error(json.error?.message || `Graph API ${res.status}`);
  return json;
}

/**
 * IG Reel: create a REELS container, wait for Meta to finish ingesting
 * the clip (containers publish only once status_code hits FINISHED),
 * then publish. Polls a few times with short waits — a 15s clip
 * normally processes in well under a minute.
 */
export async function postToInstagramReel(
  videoUrl: string,
  caption: string,
  opts: { tagUsername?: string | null } = {}
): Promise<SocialResult> {
  if (!instagramConfigured()) return { ok: false, detail: "Instagram not connected" };
  try {
    const igId = process.env.IG_USER_ID!;
    const media = await graphPost(`${igId}/media`, {
      media_type: "REELS",
      video_url: absoluteMediaUrl(videoUrl),
      caption,
      // Reel tags are username-only — no x/y on video.
      ...(opts.tagUsername
        ? { user_tags: JSON.stringify([{ username: opts.tagUsername }]) }
        : {}),
    });
    const creationId = String(media.id);
    for (let attempt = 0; attempt < 12; attempt++) {
      const status = await graphGet(creationId, { fields: "status_code" });
      if (status.status_code === "FINISHED") {
        await graphPost(`${igId}/media_publish`, { creation_id: creationId });
        return { ok: true, detail: "Reel posted to Instagram" };
      }
      if (status.status_code === "ERROR") {
        return { ok: false, detail: "Instagram couldn't process the clip" };
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    return { ok: false, detail: "Instagram is still processing the clip — it may publish late or not at all" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Instagram Reel failed" };
  }
}

export async function postToInstagram(
  imageUrl: string | null,
  caption: string,
  opts: { tagUsername?: string | null } = {}
): Promise<SocialResult> {
  if (!instagramConfigured()) return { ok: false, detail: "Instagram not connected" };
  if (!imageUrl) return { ok: false, detail: "Instagram needs a photo — add one to cross-post there" };
  try {
    const igId = process.env.IG_USER_ID!;
    const media = await graphPost(`${igId}/media`, {
      image_url: absoluteMediaUrl(imageUrl),
      caption,
      // Real attribution: the artist is tagged ON the photo, notified,
      // and the piece shows in their Tagged tab (subject to their own
      // approve-tags setting). Photo tags need x/y — bottom-centre
      // reads like a signature. Only public accounts are taggable, and
      // an untaggable one just drops the tag rather than the post.
      ...(opts.tagUsername
        ? { user_tags: JSON.stringify([{ username: opts.tagUsername, x: 0.5, y: 0.9 }]) }
        : {}),
    });
    await graphPost(`${igId}/media_publish`, { creation_id: String(media.id) });
    return { ok: true, detail: "Posted to Instagram" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Instagram post failed" };
  }
}
