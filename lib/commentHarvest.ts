import { prisma } from "./db";
import { graph, GraphError, engageConfigured } from "./metaEngage";

/**
 * Read the comments already sitting on our own Page posts.
 *
 * The webhook only ever tells us about comments left AFTER we
 * subscribed, which means every conversation the Page had before that —
 * including the "who's got the rarest pair" thread that pulled a
 * hundred replies — was invisible to the site. That is a strange thing
 * to be true of a platform built on what people argue about. This
 * closes it: a post ID goes in, the whole comment thread comes back,
 * and it lands in the same SocialVote table the webhook writes to, so a
 * comment from March is worth exactly what a comment from this morning
 * is worth.
 *
 * Read-only and reactive by construction. It pulls comments on OUR
 * posts with OUR Page token. It sends nothing, replies to nobody, and
 * touches no Page but ours — the same line the rest of the Meta
 * integration holds.
 *
 * ---------------------------------------------------------------
 * Documentation this is built from (read 2 Aug 2026, not remembered):
 *
 *   GET /{page-post-id}/comments
 *     https://developers.facebook.com/docs/graph-api/reference/page-post/comments/
 *     https://developers.facebook.com/docs/graph-api/reference/v26.0/object/comments
 *   - filter: enum{stream, toplevel}. Default toplevel. "stream" is
 *     "All-level comments in chronological order... useful for comment
 *     moderation tools where it is helpful to see a chronological list
 *     of all comments." That is exactly this, so stream it is: replies
 *     under a comment are where half the argument lives.
 *   - summary: bool. Returns order {chronological, reverse_chronological},
 *     total_count, can_comment. The doc warns total_count "can be
 *     greater than or equal to the actual number of comments returned
 *     due to comment privacy or deletion", and that it counts replies
 *     too when filter=stream — so it is reported as Facebook's number,
 *     never as a target we failed to hit.
 *   - Reading the /comments edge of a Post with a USER access token
 *     "returns empty data". A Page token is mandatory, not preferred.
 *   - "For objects that have tens of thousands of comments, you may
 *     encounter limits while paging."
 *
 *   GET /{page-id}/feed
 *     https://developers.facebook.com/docs/graph-api/reference/page/feed/
 *   - Requires pages_read_engagement AND pages_read_user_content, and a
 *     person who can perform CREATE_CONTENT, MANAGE or MODERATE on the
 *     Page.
 *   - "You can only read a maximum of 100 feed posts with the limit
 *     field. If you try to read more than that you will get an error."
 *   - Returns published AND unpublished posts; is_published separates
 *     them.
 *
 * Error 283, documented on both edges: "That action requires the
 * extended permission pages_read_engagement and/or pages_read_user_content
 * and/or pages_manage_ads and/or pages_manage_metadata."
 */

/* ------------------------------------------------------------------ */
/* Which post                                                          */
/* ------------------------------------------------------------------ */

/**
 * Turn whatever the admin pasted into something Graph will accept.
 *
 * Nobody has a post ID to hand; they have the URL in their address bar.
 * Facebook writes that URL five different ways, and one of them — the
 * /share/p/<hash> short link — carries no numeric ID at all, so it is
 * refused with an explanation rather than sent to Graph to fail with
 * "Unsupported get request", which tells the reader nothing.
 */
export function parsePostRef(input: string, pageId?: string | null): { id: string } | { error: string } {
  const raw = input.trim();
  if (!raw) return { error: "Paste a post link or ID." };

  // Already an ID: 1234567890 or 1234567890_9876543210.
  if (/^\d+(_\d+)?$/.test(raw)) return { id: raw };

  if (!/^https?:\/\//i.test(raw) && !raw.includes("facebook.com")) {
    return { error: "That isn't a Facebook post link or ID." };
  }

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return { error: "That link didn't parse. Copy it again from the post's own page." };
  }

  // The short share link is a lookup key on Facebook's side, not an
  // object ID, and there is no documented endpoint that resolves one.
  if (/^\/share\//i.test(url.pathname)) {
    return {
      error:
        "That's a share link, which carries no post ID. Use the buttons above to pick the post instead — they carry the real IDs.",
    };
  }

  // Facebook's current permalinks carry an opaque pfbid token where the
  // numeric ID used to be. Nothing in the Graph API documentation
  // resolves one, so this refuses rather than guessing at a format and
  // failing later with an error nobody can act on. The post picker
  // sidesteps it entirely: /{page-id}/feed hands back real IDs.
  if (/\bpfbid[A-Za-z0-9]+/i.test(url.pathname + url.search)) {
    return {
      error:
        "That's one of Facebook's new pfbid links, which hides the post ID. Use the buttons above to pick the post — they carry the real ID.",
    };
  }

  const qs = url.searchParams;
  // permalink.php?story_fbid=<post>&id=<page>
  const story = qs.get("story_fbid") ?? qs.get("fbid");
  if (story && /^\d+$/.test(story)) {
    const owner = qs.get("id");
    return { id: owner && /^\d+$/.test(owner) ? `${owner}_${story}` : story };
  }

  // /<page>/posts/<id>, /<page>/photos/<something>/<id>, /<page>/videos/<id>
  const seg = url.pathname.split("/").filter(Boolean);
  for (let i = seg.length - 1; i >= 0; i--) {
    const s = seg[i];
    if (/^\d+_\d+$/.test(s)) return { id: s };
    if (/^\d{6,}$/.test(s)) {
      // A bare post ID needs the Page prefixed or Graph reads it as a
      // different object entirely.
      return { id: pageId ? `${pageId}_${s}` : s };
    }
  }
  return {
    error: "Couldn't find a post ID in that link. Open the post and copy the address from the timestamp.",
  };
}

/* ------------------------------------------------------------------ */
/* The picker                                                          */
/* ------------------------------------------------------------------ */

export type PagePostSummary = {
  id: string;
  message: string | null;
  createdTime: string | null;
  permalink: string | null;
  commentCount: number | null;
};

/**
 * Recent posts, so the desk offers a list to click instead of asking
 * for an ID. limit is clamped at the documented ceiling of 100.
 */
export async function listRecentPosts(limit = 15): Promise<PagePostSummary[]> {
  const pageId = process.env.FB_PAGE_ID;
  if (!pageId || !engageConfigured()) return [];
  const json = await graph(`${pageId}/feed`, {
    fields: "id,message,created_time,permalink_url,comments.limit(0).summary(total_count)",
    limit: String(Math.min(100, Math.max(1, limit))),
  });
  const rows = (json.data ?? []) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id ?? ""),
    message: typeof r.message === "string" ? r.message : null,
    createdTime: typeof r.created_time === "string" ? r.created_time : null,
    permalink: typeof r.permalink_url === "string" ? r.permalink_url : null,
    commentCount: readSummaryCount(r.comments),
  }));
}

function readSummaryCount(v: unknown): number | null {
  if (!v || typeof v !== "object") return null;
  const summary = (v as { summary?: { total_count?: unknown } }).summary;
  const n = Number(summary?.total_count);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------ */
/* The harvest                                                         */
/* ------------------------------------------------------------------ */

/**
 * The fields asked for, richest first.
 *
 * Only `id`, `message` and `can_comment` appear by name in the edge
 * documentation; the rest are read off the Comment node and are the
 * reason this is a ladder rather than one string. Graph answers an
 * unknown field with error 100 and drops the whole request, so a single
 * optimistic list would mean one renamed field takes the entire feature
 * down. Each rung is tried in turn and the first that answers wins —
 * and which rung won is reported, so a silently thinner harvest is
 * never mistaken for a complete one.
 */
const FIELD_LADDER = [
  "id,message,created_time,from{id,name},like_count,permalink_url,parent{id},comment_count",
  "id,message,created_time,from{id,name},like_count",
  "id,message,created_time",
  "id,message",
];

/** Documented ceiling is 100 per page on the feed edge; comments take the same. */
const PAGE_SIZE = 100;
/** A self-imposed floor, not a documented one: an admin button should not walk a viral thread forever. */
const MAX_PAGES = 25;
const BUDGET_MS = 60_000;

export type HarvestedComment = {
  commentId: string;
  message: string;
  createdTime: string | null;
  fromId: string | null;
  fromName: string | null;
  likeCount: number | null;
  permalink: string | null;
  parentId: string | null;
};

export type HarvestResult = {
  ok: boolean;
  error?: string;
  postId: string;
  /** Facebook's own count. Not a target: the doc says it can exceed what is returned. */
  facebookSays: number | null;
  fetched: number;
  banked: number;
  alreadyHad: number;
  pagesWalked: number;
  /** Which rung of FIELD_LADDER answered, so a thin harvest announces itself. */
  fieldsUsed: string | null;
  stoppedEarly: string | null;
};

function parseComment(row: Record<string, unknown>): HarvestedComment | null {
  const id = typeof row.id === "string" ? row.id : null;
  const message = typeof row.message === "string" ? row.message.trim() : "";
  // A photo-only comment has no text. It is a real reply, but there is
  // nothing in it to read, and banking it would inflate every count on
  // the report with rows nobody can act on.
  if (!id || !message) return null;
  const from = (row.from ?? null) as { id?: unknown; name?: unknown } | null;
  const parent = (row.parent ?? null) as { id?: unknown } | null;
  const likes = Number(row.like_count);
  return {
    commentId: id,
    message,
    createdTime: typeof row.created_time === "string" ? row.created_time : null,
    fromId: from && typeof from.id === "string" ? from.id : null,
    fromName: from && typeof from.name === "string" ? from.name : null,
    likeCount: Number.isFinite(likes) ? likes : null,
    permalink: typeof row.permalink_url === "string" ? row.permalink_url : null,
    parentId: parent && typeof parent.id === "string" ? parent.id : null,
  };
}

/**
 * Walk the whole thread and bank every comment carrying text.
 *
 * filter=stream because replies under a comment are where the argument
 * actually happens, and toplevel — the documented default — would drop
 * them.
 */
export async function harvestComments(postId: string): Promise<HarvestResult> {
  const base: HarvestResult = {
    ok: false, postId, facebookSays: null, fetched: 0, banked: 0,
    alreadyHad: 0, pagesWalked: 0, fieldsUsed: null, stoppedEarly: null,
  };
  if (!engageConfigured()) {
    return { ...base, error: "No Page token. Connect the Page in Social HQ first." };
  }

  const started = Date.now();
  let after: string | null = null;
  let fieldIdx = 0;
  const seen = new Map<string, HarvestedComment>();

  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() - started > BUDGET_MS) {
      base.stoppedEarly = "ran out of time budget — run it again to pick up the rest";
      break;
    }
    let json: Record<string, unknown>;
    try {
      json = await graph(`${postId}/comments`, {
        fields: FIELD_LADDER[fieldIdx],
        filter: "stream",
        summary: "true",
        limit: String(PAGE_SIZE),
        ...(after ? { after } : {}),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Graph refused the call";
      // A rejected field list is recoverable and a permission problem is
      // not, so only the first is retried — and only from the first
      // page, because dropping fields mid-walk would leave half the
      // harvest richer than the other half with no way to tell which.
      const looksLikeBadField =
        e instanceof GraphError && /nonexisting field|Unknown fields|Invalid parameter/i.test(msg);
      if (looksLikeBadField && fieldIdx < FIELD_LADDER.length - 1 && page === 0) {
        fieldIdx++;
        page--;
        continue;
      }
      return { ...base, error: explainGraphError(msg), fetched: seen.size };
    }

    base.fieldsUsed = FIELD_LADDER[fieldIdx];
    base.pagesWalked = page + 1;
    const summary = (json.summary ?? null) as { total_count?: unknown } | null;
    const count = Number(summary?.total_count);
    if (Number.isFinite(count)) base.facebookSays = count;

    const rows = (json.data ?? []) as Record<string, unknown>[];
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const row of rows) {
      const c = parseComment(row);
      if (c) seen.set(c.commentId, c);
    }

    const paging = (json.paging ?? null) as { cursors?: { after?: unknown }; next?: unknown } | null;
    const nextCursor = paging?.cursors?.after;
    if (!paging?.next || typeof nextCursor !== "string") break;
    after = nextCursor;
    if (page === MAX_PAGES - 1) {
      base.stoppedEarly = `stopped at ${MAX_PAGES * PAGE_SIZE} comments — run it again for the rest`;
    }
  }

  base.fetched = seen.size;

  // Bank them. createMany with skipDuplicates leans on the commentId
  // unique index, so re-running the harvest is free and a comment the
  // webhook already delivered is never doubled.
  const comments = [...seen.values()];
  const existing = await prisma.socialVote.findMany({
    where: { commentId: { in: comments.map((c) => c.commentId) } },
    select: { commentId: true },
  });
  const had = new Set(existing.map((e) => e.commentId));
  base.alreadyHad = had.size;

  const fresh = comments.filter((c) => !had.has(c.commentId));
  if (fresh.length > 0) {
    const shoeFor = await shoeMatcher();
    const created = await prisma.socialVote.createMany({
      data: fresh.map((c) => ({
        platform: "facebook",
        postId,
        commentId: c.commentId,
        fromId: c.fromId,
        fromName: c.fromName,
        rawText: c.message.slice(0, 4000),
        // choiceLabel stays null: this is a conversation, not a poll,
        // and inventing a pick for it would poison the vote counts the
        // poll posts depend on.
        shoeName: shoeFor(c.message),
      })),
      skipDuplicates: true,
    });
    base.banked = created.count;
  }

  return { ...base, ok: true };
}

function explainGraphError(msg: string): string {
  if (/\b283\b/.test(msg) || /pages_read_user_content/i.test(msg)) {
    return `${msg} — reconnect the Page in Social HQ so it can ask for pages_read_user_content, which is what reading other people's comments needs.`;
  }
  if (/Unsupported get request|does not exist/i.test(msg)) {
    return `${msg} — that post ID didn't resolve. Open the post, copy the address from its timestamp, and paste that.`;
  }
  return msg;
}

/* ------------------------------------------------------------------ */
/* What they were arguing about                                        */
/* ------------------------------------------------------------------ */

/**
 * A silhouette matcher built once per harvest.
 *
 * Silhouette is the right grain: people type "Jordan 4 Bred", never the
 * style code. Longest name first so "Air Jordan 11" wins over
 * "Air Jordan 1" on a comment that says the former — the shorter string
 * is a prefix of the longer one and would otherwise always match first.
 */
async function shoeMatcher(): Promise<(text: string) => string | null> {
  const rows = await prisma.catalogShoe.groupBy({
    by: ["silhouette"],
    where: { silhouette: { not: null } },
  });
  const names = rows
    .map((r) => r.silhouette!)
    .filter((s) => s.length >= 4)
    .sort((a, b) => b.length - a.length);
  return (text: string) => {
    const hay = text.toLowerCase();
    for (const n of names) if (hay.includes(n.toLowerCase())) return n;
    return null;
  };
}

export type MentionRow = {
  shoeName: string;
  mentions: number;
  /** The rarest pair we track under that silhouette — the one worth a buy link. */
  rarest: {
    sku: string;
    name: string;
    imageUrl: string | null;
    rarityTier: string | null;
    rarityMultiple: number | null;
    ebayItemUrl: string | null;
  } | null;
};

/**
 * The point of harvesting: which shoes the room actually named, ranked
 * by how many people named them, each carrying the rarest pair we track
 * under that silhouette. That is the list worth writing the next post
 * about, and the one worth putting a buy link next to.
 */
export async function rarityMentions(postId?: string, take = 20): Promise<MentionRow[]> {
  const grouped = await prisma.socialVote.groupBy({
    by: ["shoeName"],
    where: { shoeName: { not: null }, ...(postId ? { postId } : {}) },
    _count: { shoeName: true },
    orderBy: { _count: { shoeName: "desc" } },
    take,
  });
  if (grouped.length === 0) return [];

  const out: MentionRow[] = [];
  for (const g of grouped) {
    const rarest = await prisma.catalogShoe.findFirst({
      where: { silhouette: g.shoeName! },
      orderBy: { rarityMultiple: { sort: "desc", nulls: "last" } },
      select: {
        sku: true, name: true, imageUrl: true,
        rarityTier: true, rarityMultiple: true, ebayItemUrl: true,
      },
    });
    out.push({ shoeName: g.shoeName!, mentions: g._count.shoeName, rarest });
  }
  return out;
}

/** The raw thread, newest first, for reading it the way he asked to. */
export async function harvestedComments(postId: string, take = 100) {
  return prisma.socialVote.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, commentId: true, fromName: true, rawText: true,
      shoeName: true, createdAt: true, userId: true,
    },
  });
}
