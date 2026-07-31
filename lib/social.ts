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

/**
 * The link rides the FIRST COMMENT, never the caption. Facebook's feed
 * treats a post with an outbound link in its text as a link post and
 * shows it to fewer people — the exact opposite of why the link is
 * there. So the post publishes clean, and the link lands as our own
 * first comment on it, where reach is untouched and the click still
 * has somewhere to go. House rule, not a preference: nothing in this
 * file may put a link in a caption or pass Facebook's link parameter.
 */
async function commentLinkOnPost(postId: string, link: string): Promise<boolean> {
  try {
    await graphPost(`${postId}/comments`, { message: link });
    return true;
  } catch {
    return false;
  }
}

/**
 * Queue rather than publish. Meta accepts a scheduled feed post between
 * 10 minutes and 75 days out; anything outside that is refused, so this
 * returns null instead of sending a request that cannot succeed.
 *
 * Returned as the two params Meta wants together: a post is scheduled by
 * being UNPUBLISHED with a time on it, and sending the time without
 * published=false just posts it immediately.
 */
export function scheduleParams(at: Date | null | undefined): Record<string, string> | null {
  if (!at) return null;
  const secs = Math.floor(at.getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);
  if (secs < now + 600 || secs > now + 75 * 86400) return null;
  return { published: "false", scheduled_publish_time: String(secs) };
}

/**
 * Strip any bare URL out of copy that is going to sit above a link
 * card. The card already IS the link; a URL in the words as well is the
 * shape the house rule exists to prevent, and it reads as spam twice.
 */
export function stripUrls(text: string): string {
  return text
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/\b(?:www\.)[^\s]+/gi, "")
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/[^\S\n]+([.,!?])/g, "$1")
    .trim();
}

/**
 * The card post. No photo — the link IS the image.
 *
 * This is the API version of the trick of pasting a link into the
 * composer, letting the card populate, then deleting the URL and typing
 * a description over it. The API does it properly: `link` generates the
 * card and `message` is the text above it, so the URL never has to
 * appear in the words at all. Nothing to delete, because nothing was
 * ever typed.
 *
 * Deliberately separate from postToFacebookPage rather than a flag on
 * it. The house rule stands: our PHOTO post never carries a link in its
 * text and puts the link in the first comment. This is a different post
 * with a different job, published on its own.
 */
export async function postLinkCardToFacebookPage(
  message: string,
  link: string,
  opts: { scheduledAt?: Date | null } = {}
): Promise<SocialResult> {
  if (!facebookConfigured()) return { ok: false, detail: "Facebook not connected" };
  if (!link) return { ok: false, detail: "A card post needs a link" };
  const sched = scheduleParams(opts.scheduledAt);
  if (opts.scheduledAt && !sched) {
    return {
      ok: false,
      detail: "Schedule a post between 10 minutes and 75 days out — Meta refuses anything else.",
    };
  }
  try {
    const pageId = process.env.FB_PAGE_ID!;
    // The card is scraped from the destination's own OG tags. Overriding
    // the card art per post is a different feature that needs an
    // ownership precheck first, so this deliberately does not try.
    await graphPost(`${pageId}/feed`, {
      message: stripUrls(message),
      link,
      ...(sched ?? {}),
    });
    return {
      ok: true,
      detail: sched ? "Card post scheduled" : "Card post published",
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Card post failed" };
  }
}

/**
 * Both posts, one call: the photo now, the card later.
 *
 * The photo post goes out immediately with the link as its own first
 * comment, which is the shape that reaches the most people. Twelve
 * hours later the same destination goes out again as a bare link card,
 * which is a different-looking object in the feed and catches the half
 * of the audience that was asleep the first time.
 *
 * Two posts, one destination, no duplicate-looking content.
 */
export async function postWithFollowUpCard(
  message: string,
  opts: {
    imageUrl?: string | null;
    link: string;
    /** Copy for the card post. Falls back to the first post's words. */
    cardMessage?: string | null;
    hoursLater?: number;
  }
): Promise<{ first: SocialResult; card: SocialResult }> {
  const first = await postToFacebookPage(message, {
    imageUrl: opts.imageUrl,
    link: opts.link,
  });
  // The card is a follow-up, not a consolation prize: if the first post
  // failed we are in an unknown state and queueing a second one on top
  // of that just makes it harder to see what happened.
  if (!first.ok) {
    return { first, card: { ok: false, detail: "Skipped — the first post didn't publish" } };
  }
  const hours = Math.min(Math.max(opts.hoursLater ?? 12, 1), 72);
  const card = await postLinkCardToFacebookPage(opts.cardMessage || message, opts.link, {
    scheduledAt: new Date(Date.now() + hours * 3_600_000),
  });
  return { first, card };
}

export async function postToFacebookPage(
  message: string,
  opts: { imageUrl?: string | null; link?: string | null; scheduledAt?: Date | null } = {}
): Promise<SocialResult> {
  if (!facebookConfigured()) return { ok: false, detail: "Facebook not connected" };
  try {
    const pageId = process.env.FB_PAGE_ID!;
    const sched = scheduleParams(opts.scheduledAt);
    if (opts.scheduledAt && !sched) {
      return {
        ok: false,
        detail: "Schedule a post between 10 minutes and 75 days out — Meta refuses anything else.",
      };
    }
    let postId = "";
    if (opts.imageUrl) {
      // /photos answers with both its photo id and the id of the feed
      // story it created — the comment goes on the story.
      const res = await graphPost(`${pageId}/photos`, {
        url: absoluteMediaUrl(opts.imageUrl),
        caption: message,
        ...(sched ?? {}),
      });
      postId = String(res.post_id ?? res.id ?? "");
    } else {
      const res = await graphPost(`${pageId}/feed`, { message, ...(sched ?? {}) });
      postId = String(res.id ?? "");
    }
    // A scheduled post has no comments yet and nobody can see it, so the
    // first-comment link has to wait until it actually goes live. Saying
    // so is better than silently dropping the link.
    if (sched) {
      return {
        ok: true,
        detail: opts.link
          ? "Scheduled. Drop the link in the first comment once it publishes."
          : "Scheduled.",
      };
    }
    if (opts.link && postId) {
      const commented = await commentLinkOnPost(postId, opts.link);
      return {
        ok: true,
        detail: commented
          ? "Posted — link dropped in the first comment"
          : "Posted, but the link comment was refused — add it by hand",
      };
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
