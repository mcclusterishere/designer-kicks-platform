import { siteUrl } from "./articles";

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

const GRAPH = "https://graph.facebook.com/v21.0";

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
  const body = new URLSearchParams({
    ...params,
    access_token: process.env.FB_PAGE_ACCESS_TOKEN ?? "",
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

export async function postToInstagram(
  imageUrl: string | null,
  caption: string
): Promise<SocialResult> {
  if (!instagramConfigured()) return { ok: false, detail: "Instagram not connected" };
  if (!imageUrl) return { ok: false, detail: "Instagram needs a photo — add one to cross-post there" };
  try {
    const igId = process.env.IG_USER_ID!;
    const media = await graphPost(`${igId}/media`, {
      image_url: absoluteMediaUrl(imageUrl),
      caption,
    });
    await graphPost(`${igId}/media_publish`, { creation_id: String(media.id) });
    return { ok: true, detail: "Posted to Instagram" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Instagram post failed" };
  }
}
