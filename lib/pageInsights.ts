import { prisma } from "./db";
import { graph, GraphError, engageConfigured } from "./metaEngage";

/**
 * What the Page is actually doing, read from Meta, kept, and turned into
 * something to act on.
 *
 * ---------------------------------------------------------------
 * The problem this module is shaped around
 *
 * Meta has cut the Page Insights metric list four times in two years —
 * March 2024, June 2025, November 2025, and a wave dated June 2026 that
 * has already passed. Every cut turns a working metric name into an
 * "invalid metric" error, and because the endpoint takes a comma list,
 * ONE dead name takes the entire batch down with it. A hardcoded metric
 * list is therefore a list of scheduled outages.
 *
 * So this module never trusts a metric name — not one from the docs and
 * certainly not one from memory. It asks Meta about each candidate ON
 * ITS OWN, writes down the answer, and only ever batches names Meta has
 * actually answered to. When the next wave lands, the probe notices, the
 * dashboard says which metric died and in Meta's own words, and nothing
 * else breaks.
 *
 * ---------------------------------------------------------------
 * Documentation read 2 Aug 2026 (not remembered):
 *
 *   Page/insights — https://developers.facebook.com/docs/graph-api/reference/v26.0/insights
 *   Get Page Insights — https://developers.facebook.com/documentation/pages-api/platforminsights/page
 *   Deprecated metrics — https://developers.facebook.com/documentation/pages-api/platforminsights/page/deprecated-metrics
 *     (that page's own "Updated:" line reads 2 March 2026)
 *
 *   - Permissions: read_insights AND pages_read_engagement, with a Page
 *     access token from someone who can perform the ANALYZE task.
 *   - "Page Insights data is only available on Pages with 100 or more
 *     likes." Under that, this returns nothing at all — a real state,
 *     not a bug, and the desk says so rather than showing zeroes.
 *   - "Most metrics will update once every 24 hours."
 *   - "Only the last two years of insights data is available", and only
 *     90 days at a time through since/until.
 *   - "Demographic metrics, such as age, gender, and location, are only
 *     returned if there is data for 100 or more people."
 *   - Omitting the metric parameter is error 3001 / subcode 1504028.
 */

/* ------------------------------------------------------------------ */
/* The graveyard                                                       */
/* ------------------------------------------------------------------ */

/**
 * Every metric Meta's deprecated-metrics page lists as already refused,
 * transcribed from that page. Nothing here is ever sent — a probe would
 * just be a request we already know the answer to, and shipping one of
 * these in a batch is the exact failure this module exists to prevent.
 *
 * Kept as data rather than as a comment so a test can assert that no
 * candidate below has quietly drifted onto it.
 */
export const DEAD_METRICS: string[] = [
  // Deprecated by 15 June 2025
  "page_impressions_unique", "page_impressions_paid_unique", "page_impressions_viral_unique",
  "page_impressions_nonviral_unique", "page_posts_impressions", "page_posts_impressions_unique",
  "page_posts_impressions_paid", "page_posts_impressions_paid_unique",
  "page_posts_impressions_organic_unique", "page_posts_served_impressions_organic_unique",
  "page_posts_impressions_viral", "page_posts_impressions_viral_unique",
  "page_posts_impressions_nonviral", "page_posts_impressions_nonviral_unique",
  "post_impressions_unique", "post_impressions_paid_unique", "post_impressions_fan_unique",
  "post_impressions_organic_unique", "post_impressions_viral_unique",
  "post_impressions_nonviral_unique",
  // Deprecated 15 November 2025
  "page_fans", "page_fans_locale", "page_fans_city", "page_fans_country",
  "page_fan_adds", "page_fan_adds_unique", "page_fan_removes", "page_fan_removes_unique",
  "page_impressions", "page_impressions_paid", "page_impressions_viral", "page_impressions_nonviral",
  "post_impressions", "post_impressions_paid", "post_impressions_fan",
  "post_impressions_organic", "post_impressions_viral", "post_impressions_nonviral",
  // Deprecated 14 March 2024 (the ones a Page dashboard would plausibly reach for)
  "page_consumptions", "page_content_activity", "page_content_activity_by_action_type",
  "page_content_activity_unique", "page_engaged_users", "page_fans_by_like_source",
  "page_fans_by_like_source_unique", "page_fans_by_unlike_source", "page_fans_by_unlike_source_unique",
  "page_fans_gender_age", "page_follows_gender_age", "page_follows_locale",
  "page_impressions_frequency_distribution", "page_positive_feedback_by_type",
  "page_positive_feedback_by_type_unique", "page_positive_feedback", "page_positive_feedback_unique",
  "page_posts_impressions_frequency_distribution", "page_views_by_profile_tab_total",
  "page_views_external_referrals", "page_views_logged_in_total", "page_views_logged_in_unique",
  "page_views_login", "page_views_login_unique", "page_views_logout",
  "post_activity", "post_activity_unique", "post_impressions_fan_paid",
  "post_impressions_fan_paid_unique",
];

const DEAD = new Set(DEAD_METRICS.map((m) => m.toLowerCase()));

/* ------------------------------------------------------------------ */
/* The candidates                                                      */
/* ------------------------------------------------------------------ */

export type MetricCandidate = {
  metric: string;
  scope: "page" | "post";
  period: string;
  /** Why we want it, in the language the dashboard uses. */
  label: string;
  /** The metric it was promoted from, when Meta named a replacement. */
  replaces?: string;
};

/**
 * What we would LIKE, in the order we care about it. Every one of these
 * is a candidate, never an assumption: none is used until a probe has
 * seen Meta answer to it.
 *
 * The alternatives named here are Meta's own, taken off the
 * deprecated-metrics page — page_media_view is the documented
 * replacement for page_impressions, page_follows for page_fans.
 */
export const METRIC_CANDIDATES: MetricCandidate[] = [
  { metric: "page_media_view", scope: "page", period: "day", label: "Content shown", replaces: "page_impressions" },
  { metric: "page_total_media_view_unique", scope: "page", period: "day", label: "People reached", replaces: "page_impressions_unique" },
  { metric: "page_follows", scope: "page", period: "day", label: "Follows", replaces: "page_fans" },
  { metric: "page_post_engagements", scope: "page", period: "day", label: "Post engagements" },
  { metric: "page_total_actions", scope: "page", period: "day", label: "Clicks on your contact info and CTA" },
  { metric: "page_video_views", scope: "page", period: "day", label: "Video views" },
  { metric: "page_daily_follows_unique", scope: "page", period: "day", label: "New follows" },
  { metric: "page_follows_city", scope: "page", period: "day", label: "Follows by city" },
  { metric: "page_follows_country", scope: "page", period: "day", label: "Follows by country" },
  { metric: "post_media_view", scope: "post", period: "lifetime", label: "Times shown", replaces: "post_impressions" },
  { metric: "post_total_media_view_unique", scope: "post", period: "lifetime", label: "People reached", replaces: "post_impressions_unique" },
  { metric: "post_reactions_by_type_total", scope: "post", period: "lifetime", label: "Reactions by type" },
  { metric: "post_clicks_by_type", scope: "post", period: "lifetime", label: "Clicks by type" },
  { metric: "post_activity_by_action_type", scope: "post", period: "lifetime", label: "Shares and comments" },
];

/** A candidate on the graveyard list is a bug in this file, not a probe. */
export function candidatesAreClean(): string[] {
  return METRIC_CANDIDATES.filter((c) => DEAD.has(c.metric.toLowerCase())).map((c) => c.metric);
}

export function isDeadMetric(metric: string): boolean {
  return DEAD.has(metric.trim().toLowerCase());
}

/* ------------------------------------------------------------------ */
/* Probing                                                             */
/* ------------------------------------------------------------------ */

/** Meta's way of saying a metric no longer exists. */
function refusedMetric(msg: string): boolean {
  return /invalid metric|nonexisting field|does not (?:exist|support)|unsupported get request|(?:^|\D)100(?:\D|$)/i.test(
    msg
  );
}

export type ProbeResult = {
  ok: boolean;
  error?: string;
  alive: string[];
  dead: { metric: string; note: string }[];
  skipped: number;
};

/**
 * Ask Meta about each candidate on its own and write down the answer.
 *
 * One request per metric is the whole point: batched, a single dead name
 * fails the lot and tells you nothing about the other thirteen.
 *
 * A post-scope candidate needs a real post to ask about, so the newest
 * post is used as the specimen. Without one, post metrics stay UNKNOWN
 * rather than being marked dead — never having asked is not the same
 * fact as having been refused.
 */
export async function probeMetrics(specimenPostId?: string | null): Promise<ProbeResult> {
  const pageId = process.env.FB_PAGE_ID;
  if (!pageId || !engageConfigured()) {
    return { ok: false, error: "No Page token. Connect the Page in Social HQ first.", alive: [], dead: [], skipped: 0 };
  }
  const bad = candidatesAreClean();
  if (bad.length > 0) {
    return { ok: false, error: `Candidate list contains metrics Meta already refuses: ${bad.join(", ")}`, alive: [], dead: [], skipped: 0 };
  }

  const alive: string[] = [];
  const dead: { metric: string; note: string }[] = [];
  let skipped = 0;

  for (const c of METRIC_CANDIDATES) {
    const target = c.scope === "page" ? pageId : specimenPostId;
    if (!target) {
      skipped++;
      continue;
    }
    let status: "ALIVE" | "DEAD" | "UNKNOWN" = "UNKNOWN";
    let note: string | null = null;
    try {
      await graph(`${target}/insights`, { metric: c.metric, period: c.period });
      status = "ALIVE";
      alive.push(c.metric);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof GraphError && refusedMetric(msg)) {
        // Meta answered and said no. That is knowledge worth keeping.
        status = "DEAD";
        note = msg;
        dead.push({ metric: c.metric, note: msg });
      } else {
        // A timeout, a rate limit, a permissions problem: we learned
        // nothing about this metric, so we record nothing about it.
        status = "UNKNOWN";
        note = msg;
        skipped++;
      }
    }
    await prisma.metricProbe.upsert({
      where: { metric: c.metric },
      update: { status, note, scope: c.scope, checkedAt: new Date() },
      create: { metric: c.metric, scope: c.scope, status, note },
    });
  }

  return { ok: true, alive, dead, skipped };
}

/** Only names Meta has actually answered to. */
export async function liveMetrics(scope: "page" | "post"): Promise<MetricCandidate[]> {
  const probes = await prisma.metricProbe.findMany({ where: { scope, status: "ALIVE" }, select: { metric: true } });
  const ok = new Set(probes.map((p) => p.metric));
  return METRIC_CANDIDATES.filter((c) => c.scope === scope && ok.has(c.metric));
}

/* ------------------------------------------------------------------ */
/* Reading and banking                                                 */
/* ------------------------------------------------------------------ */

type InsightRow = {
  name?: unknown;
  period?: unknown;
  values?: { value?: unknown; end_time?: unknown }[];
};

/**
 * A metric value is either a number or, for a broken-down metric, an
 * object of key → number. Both are flattened to one row per key so the
 * store has a single shape and a chart never has to branch.
 */
function flatten(objectId: string, scope: string, row: InsightRow) {
  const out: {
    objectId: string; scope: string; metric: string; period: string;
    endTime: Date; value: number; breakdown: string;
  }[] = [];
  const metric = typeof row.name === "string" ? row.name : null;
  const period = typeof row.period === "string" ? row.period : "lifetime";
  if (!metric || !Array.isArray(row.values)) return out;
  for (const v of row.values) {
    const endTime = typeof v.end_time === "string" ? new Date(v.end_time) : new Date();
    if (isNaN(endTime.getTime())) continue;
    if (typeof v.value === "number") {
      // Empty string, never null: Postgres does not treat NULL as equal
      // to NULL in a unique index, so a null here would defeat
      // skipDuplicates and let the nightly cron double the history.
      out.push({ objectId, scope, metric, period, endTime, value: v.value, breakdown: "" });
    } else if (v.value && typeof v.value === "object") {
      for (const [k, n] of Object.entries(v.value as Record<string, unknown>)) {
        const num = Number(n);
        if (Number.isFinite(num)) {
          out.push({ objectId, scope, metric, period, endTime, value: num, breakdown: k });
        }
      }
    }
  }
  return out;
}

export type SnapshotResult = {
  ok: boolean;
  error?: string;
  metricsAsked: number;
  pointsBanked: number;
  /** True when Meta answered but had nothing — the sub-100-likes state. */
  emptyButFine: boolean;
};

/**
 * Pull every live Page metric and bank the values.
 *
 * Metrics are batched here, which is safe precisely because the probe
 * already removed anything Meta refuses.
 */
export async function snapshotPageInsights(): Promise<SnapshotResult> {
  const pageId = process.env.FB_PAGE_ID;
  if (!pageId || !engageConfigured()) {
    return { ok: false, error: "No Page token.", metricsAsked: 0, pointsBanked: 0, emptyButFine: false };
  }
  const live = await liveMetrics("page");
  if (live.length === 0) {
    return {
      ok: false,
      error: "No Page metric has been confirmed yet — run the probe first.",
      metricsAsked: 0, pointsBanked: 0, emptyButFine: false,
    };
  }

  let rows: InsightRow[];
  try {
    const json = await graph(`${pageId}/insights`, {
      metric: live.map((m) => m.metric).join(","),
      period: "day",
    });
    rows = (json.data ?? []) as InsightRow[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // A metric died between the probe and now. Mark it and say which.
    if (e instanceof GraphError && refusedMetric(msg)) {
      await markSuspect(msg, "page");
      return {
        ok: false,
        error: `${msg} — a metric died since the last probe. Re-run the probe; the dashboard will name it.`,
        metricsAsked: live.length, pointsBanked: 0, emptyButFine: false,
      };
    }
    return { ok: false, error: msg, metricsAsked: live.length, pointsBanked: 0, emptyButFine: false };
  }

  const points = rows.flatMap((r) => flatten(pageId, "page", r));
  const banked = points.length
    ? (await prisma.insightPoint.createMany({ data: points, skipDuplicates: true })).count
    : 0;

  return {
    ok: true,
    metricsAsked: live.length,
    pointsBanked: banked,
    // Meta answered, and the answer was nothing. On a Page under 100
    // likes that is documented behaviour, not a failure.
    emptyButFine: points.length === 0,
  };
}

/** When a batch dies, flag whichever metric Meta named so the probe can confirm. */
async function markSuspect(message: string, scope: "page" | "post") {
  const named = METRIC_CANDIDATES.filter((c) => c.scope === scope && message.includes(c.metric));
  for (const c of named) {
    await prisma.metricProbe.updateMany({
      where: { metric: c.metric },
      data: { status: "UNKNOWN", note: `suspect after a failed batch: ${message}` },
    });
  }
}

/* ------------------------------------------------------------------ */
/* Post performance — the part that works on a small Page              */
/* ------------------------------------------------------------------ */

/**
 * Comments, reactions and shares come off the post node itself, which
 * needs no read_insights and — unlike Page Insights — has no 100-like
 * floor. That is deliberate: the decision engine below runs on THIS,
 * so a Page too small for Insights still gets told when to post.
 *
 * Laddered for the same reason the comment harvest is: reaction and
 * share summaries are not named in the feed documentation the way
 * comments are, so they are attempted and dropped rather than assumed.
 */
const POST_FIELD_LADDER = [
  "id,message,created_time,permalink_url,status_type,shares,attachments{media_type},comments.limit(0).summary(total_count),reactions.limit(0).summary(total_count)",
  "id,message,created_time,permalink_url,status_type,shares,comments.limit(0).summary(total_count)",
  "id,message,created_time,permalink_url,comments.limit(0).summary(total_count)",
  "id,message,created_time",
];

function summaryCount(v: unknown): number {
  if (!v || typeof v !== "object") return 0;
  const n = Number((v as { summary?: { total_count?: unknown } }).summary?.total_count);
  return Number.isFinite(n) ? n : 0;
}

function postTypeOf(row: Record<string, unknown>): string | null {
  const att = (row.attachments ?? null) as { data?: { media_type?: unknown }[] } | null;
  const mt = att?.data?.[0]?.media_type;
  if (typeof mt === "string" && mt) return mt;
  const st = row.status_type;
  return typeof st === "string" && st ? st : null;
}

export type PostStatsResult = {
  ok: boolean;
  error?: string;
  posts: number;
  fieldsUsed: string | null;
};

/** Refresh the stats for the most recent posts. */
export async function refreshPostStats(limit = 50): Promise<PostStatsResult> {
  const pageId = process.env.FB_PAGE_ID;
  if (!pageId || !engageConfigured()) {
    return { ok: false, error: "No Page token.", posts: 0, fieldsUsed: null };
  }
  let rows: Record<string, unknown>[] = [];
  let used: string | null = null;
  for (const fields of POST_FIELD_LADDER) {
    try {
      // The feed edge documents a hard ceiling of 100 on limit.
      const json = await graph(`${pageId}/feed`, { fields, limit: String(Math.min(100, limit)) });
      rows = (json.data ?? []) as Record<string, unknown>[];
      used = fields;
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof GraphError && refusedMetric(msg)) continue;
      return { ok: false, error: msg, posts: 0, fieldsUsed: null };
    }
  }
  if (used === null) {
    return { ok: false, error: "Every field list was refused — the Page connection may need reconnecting.", posts: 0, fieldsUsed: null };
  }

  let n = 0;
  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id : null;
    const created = typeof row.created_time === "string" ? new Date(row.created_time) : null;
    if (!id || !created || isNaN(created.getTime())) continue;
    const shares = Number((row.shares as { count?: unknown } | null)?.count ?? 0);
    const data = {
      message: typeof row.message === "string" ? row.message.slice(0, 2000) : null,
      permalink: typeof row.permalink_url === "string" ? row.permalink_url : null,
      publishedAt: created,
      postType: postTypeOf(row),
      comments: summaryCount(row.comments),
      reactions: summaryCount(row.reactions),
      shares: Number.isFinite(shares) ? shares : 0,
    };
    await prisma.postStat.upsert({ where: { postId: id }, update: data, create: { postId: id, ...data } });
    n++;
  }
  return { ok: true, posts: n, fieldsUsed: used };
}

/* ------------------------------------------------------------------ */
/* The decisions                                                       */
/* ------------------------------------------------------------------ */

/** Engagement per post, the only currency the Page actually spends. */
function engagementOf(p: { comments: number; reactions: number; shares: number }): number {
  // A share is worth more than a reaction because it is the only one
  // that puts the post in front of somebody who does not follow us.
  return p.comments * 3 + p.shares * 5 + p.reactions;
}

export type Decision = {
  headline: string;
  detail: string;
  /** How much data it rests on, so a one-post "finding" reads as one post. */
  basis: string;
  confident: boolean;
};

const HOUR_LABELS = (h: number) => {
  const am = h < 12;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${am ? "am" : "pm"}`;
};

/**
 * Turn the numbers into things to do differently.
 *
 * Every claim carries what it rests on. A "best hour" drawn from three
 * posts is noise dressed as insight, and the surest way to make a
 * dashboard worthless is to let it say the same thing at n=3 as at
 * n=300 — so thin findings say they are thin instead of being hidden.
 */
export async function decisions(minPosts = 8): Promise<{ decisions: Decision[]; posts: number }> {
  const posts = await prisma.postStat.findMany({
    orderBy: { publishedAt: "desc" },
    take: 200,
    select: {
      postId: true, message: true, permalink: true, publishedAt: true,
      postType: true, comments: true, reactions: true, shares: true,
    },
  });
  if (posts.length === 0) return { decisions: [], posts: 0 };

  const out: Decision[] = [];
  const enough = posts.length >= minPosts;
  const tz = "America/New_York";
  const hourOf = (d: Date) =>
    Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(d));
  const dayOf = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(d);

  // ---- When to post ----------------------------------------------------
  const byHour = new Map<number, { total: number; n: number }>();
  for (const p of posts) {
    const h = hourOf(p.publishedAt);
    const cur = byHour.get(h) ?? { total: 0, n: 0 };
    cur.total += engagementOf(p);
    cur.n++;
    byHour.set(h, cur);
  }
  // Only hours with more than one post can be compared at all.
  const hours = [...byHour.entries()]
    .filter(([, v]) => v.n >= 2)
    .map(([h, v]) => ({ h, avg: v.total / v.n, n: v.n }))
    .sort((a, b) => b.avg - a.avg);
  if (hours.length >= 2) {
    const best = hours[0];
    const worst = hours[hours.length - 1];
    out.push({
      headline: `Post around ${HOUR_LABELS(best.h)} Eastern`,
      detail: `Posts published in that hour average ${Math.round(best.avg)} engagement against ${Math.round(worst.avg)} at ${HOUR_LABELS(worst.h)}.`,
      basis: `${best.n} post${best.n === 1 ? "" : "s"} in the winning hour, ${posts.length} overall`,
      confident: enough && best.n >= 3 && best.avg > worst.avg * 1.5,
    });
  }

  // ---- What to post ----------------------------------------------------
  const byType = new Map<string, { total: number; n: number }>();
  for (const p of posts) {
    const t = p.postType ?? "unknown";
    const cur = byType.get(t) ?? { total: 0, n: 0 };
    cur.total += engagementOf(p);
    cur.n++;
    byType.set(t, cur);
  }
  const types = [...byType.entries()]
    .filter(([t, v]) => t !== "unknown" && v.n >= 2)
    .map(([t, v]) => ({ t, avg: v.total / v.n, n: v.n }))
    .sort((a, b) => b.avg - a.avg);
  if (types.length >= 2) {
    out.push({
      headline: `${types[0].t} posts outperform ${types[types.length - 1].t}`,
      detail: `${Math.round(types[0].avg)} average engagement against ${Math.round(types[types.length - 1].avg)}.`,
      basis: `${types[0].n} vs ${types[types.length - 1].n} posts`,
      confident: enough && types[0].n >= 3,
    });
  }

  // ---- What starts an argument ----------------------------------------
  // The site's whole thesis is that people come back for what they can
  // argue about, so a post that pulls comments is worth more than one
  // that pulls reactions, and it is worth knowing which did.
  const withComments = posts.filter((p) => p.comments > 0);
  if (withComments.length >= 2) {
    const top = [...withComments].sort((a, b) => b.comments - a.comments)[0];
    const avgComments = posts.reduce((t, p) => t + p.comments, 0) / posts.length;
    const asked = /\?/.test(top.message ?? "");
    out.push({
      headline: asked
        ? "Your best comment-puller asked a question"
        : `"${(top.message ?? "A post").slice(0, 50).trim()}…" pulled the most argument`,
      detail: `${top.comments} comments against an average of ${avgComments.toFixed(1)}.${
        asked ? " Questions are what the room answers — write more of them." : ""
      }`,
      basis: `${posts.length} posts read`,
      confident: enough && top.comments >= avgComments * 2,
    });
  }

  // ---- The day -----------------------------------------------------------
  const byDay = new Map<string, { total: number; n: number }>();
  for (const p of posts) {
    const d = dayOf(p.publishedAt);
    const cur = byDay.get(d) ?? { total: 0, n: 0 };
    cur.total += engagementOf(p);
    cur.n++;
    byDay.set(d, cur);
  }
  const days = [...byDay.entries()]
    .filter(([, v]) => v.n >= 2)
    .map(([d, v]) => ({ d, avg: v.total / v.n, n: v.n }))
    .sort((a, b) => b.avg - a.avg);
  if (days.length >= 3) {
    out.push({
      headline: `${days[0].d} is your day`,
      detail: `${Math.round(days[0].avg)} average engagement, against ${Math.round(days[days.length - 1].avg)} on ${days[days.length - 1].d}.`,
      basis: `${days[0].n} posts on ${days[0].d}`,
      confident: enough && days[0].n >= 3,
    });
  }

  // ---- Silence is a finding too ---------------------------------------
  if (!enough) {
    out.push({
      headline: `Only ${posts.length} posts to read`,
      detail: `Nothing above is settled yet. It takes about ${minPosts} posts before an hour or a format is telling you anything a coin flip wouldn't.`,
      basis: "not enough data",
      confident: false,
    });
  }

  return { decisions: out, posts: posts.length };
}

/** The Page-level trend, when Insights is available at all. */
export async function pageTrend(metric: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  return prisma.insightPoint.findMany({
    where: { scope: "page", metric, endTime: { gte: since }, breakdown: "" },
    orderBy: { endTime: "asc" },
    select: { endTime: true, value: true },
  });
}

export type InsightsHealth = {
  configured: boolean;
  probed: boolean;
  alive: { metric: string; label: string; replaces?: string }[];
  dead: { metric: string; note: string | null; checkedAt: Date }[];
  unknown: number;
  lastPointAt: Date | null;
  postsTracked: number;
};

/** What the desk needs to explain itself honestly. */
export async function insightsHealth(): Promise<InsightsHealth> {
  const [probes, latest, postsTracked] = await Promise.all([
    prisma.metricProbe.findMany({ orderBy: { metric: "asc" } }),
    prisma.insightPoint.findFirst({ orderBy: { endTime: "desc" }, select: { endTime: true } }),
    prisma.postStat.count(),
  ]);
  const byName = new Map(METRIC_CANDIDATES.map((c) => [c.metric, c]));
  return {
    configured: engageConfigured(),
    probed: probes.length > 0,
    alive: probes
      .filter((p) => p.status === "ALIVE")
      .map((p) => ({
        metric: p.metric,
        label: byName.get(p.metric)?.label ?? p.metric,
        replaces: byName.get(p.metric)?.replaces,
      })),
    dead: probes
      .filter((p) => p.status === "DEAD")
      .map((p) => ({ metric: p.metric, note: p.note, checkedAt: p.checkedAt })),
    unknown: probes.filter((p) => p.status === "UNKNOWN").length,
    lastPointAt: latest?.endTime ?? null,
    postsTracked,
  };
}
