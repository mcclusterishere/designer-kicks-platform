import type { SocialPost, SocialTarget } from "@prisma/client";

/**
 * The wire. One queued post, delivered to its destination.
 *
 * Split from the queue so scheduling and rule-checking can be tested
 * without touching a network, and so a new platform is one case here rather
 * than a change to the scheduler.
 *
 * Reddit gets its own path because it's the only one where the destination
 * varies per post: the target's `name` is the subreddit, not a single
 * value from the environment. That's the whole reason a feed can be in
 * several communities at once without being wrong in most of them.
 */

export type SendResult = { ok: boolean; detail: string };

function fail(e: unknown): SendResult {
  return { ok: false, detail: e instanceof Error ? e.message : "failed" };
}

const UA = "TheHeatChart/1.0 (drip feed; contact: hello@theheatchart.com)";

async function redditToken(): Promise<string | null> {
  const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD } = process.env;
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) return null;
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: REDDIT_USERNAME,
      password: REDDIT_PASSWORD,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string };
  return json.access_token ?? null;
}

async function sendReddit(post: SocialPost, target: SocialTarget): Promise<SendResult> {
  const sub = target.name?.replace(/^r\//, "").trim();
  if (!sub) return { ok: false, detail: "target has no subreddit set" };

  const token = await redditToken();
  if (!token) return { ok: false, detail: "Reddit credentials not configured" };

  // A link post advertises; a self post with the image contributes. Where
  // links aren't allowed we post the writeup, and the source goes in a
  // follow-up comment only if someone asks — which is the convention these
  // communities actually accept.
  const kind = target.allowLinks && post.link ? "link" : "self";
  const body = new URLSearchParams({
    sr: sub,
    kind,
    title: post.title.slice(0, 300),
    api_type: "json",
    ...(kind === "link" ? { url: post.link! } : { text: post.body ?? "" }),
    ...(post.flair ? { flair_text: post.flair } : {}),
  });

  try {
    const res = await fetch("https://oauth.reddit.com/api/submit", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      body,
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      json?: { errors?: unknown[][]; data?: { url?: string } };
    };
    const errors = json.json?.errors ?? [];
    if (!res.ok || errors.length > 0) {
      // Reddit reports rule rejections here — surface the moderator's own
      // wording rather than a generic failure, since that's what tells you
      // which rule the feed tripped.
      return { ok: false, detail: String(errors[0]?.[1] ?? `reddit ${res.status}`) };
    }
    return { ok: true, detail: json.json?.data?.url ?? `posted to r/${sub}` };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Everything else rides the existing instant-channel senders — but one
 * channel at a time. Fanning out to all five and keeping one result would
 * turn every queued post into five posts, which is precisely the behaviour
 * the queue exists to stop.
 */
async function sendViaInstant(post: SocialPost, platform: string): Promise<SendResult> {
  const { postToOne } = await import("./socialInstant");
  const text = post.link ? `${post.title}\n\n${post.link}` : post.title;
  const res = await postToOne(platform, {
    text: text.slice(0, 280),
    link: post.link ?? "",
    imageUrls: post.mediaUrl ? [post.mediaUrl] : [],
  });
  return { ok: res.ok, detail: res.detail };
}

export async function sendOne(post: SocialPost, target: SocialTarget): Promise<SendResult> {
  if (target.platform === "REDDIT") return sendReddit(post, target);
  return sendViaInstant(post, target.platform);
}
