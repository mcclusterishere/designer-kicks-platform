import { createHmac } from "crypto";
import { prisma } from "./db";
import { dailySeries } from "./analytics";

// First-party traffic analytics. Cookieless by design: no tracking
// cookie, no raw IP at rest, daily-rotating visitor hash. This keeps
// the privacy-policy promise ("privacy-friendly and cookie-free")
// while still answering the only question that matters on launch day:
// did the Facebook post actually send people?

const DAY = 24 * 60 * 60 * 1000;

/** Crawlers and preview bots never count as traffic. */
export function isBot(userAgent: string): boolean {
  return /bot|crawl|spider|slurp|preview|scrape|curl|wget|python-requests|lighthouse|facebookexternalhit|whatsapp|telegram|discord|vkshare|semrush|ahrefs/i.test(
    userAgent
  );
}

export function deviceFrom(userAgent: string): string {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent) ? "mobile" : "desktop";
}

/**
 * Anonymous visitor identity: HMAC(ip + user-agent + UTC day). The
 * raw IP is hashed immediately and never stored; the hash rotates
 * every day, so it can't build a long-term profile of anyone.
 */
export function visitorHash(ip: string, userAgent: string): string {
  const secret = process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "heatchart-traffic";
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", secret).update(`${ip}|${userAgent}|${day}`).digest("hex").slice(0, 32);
}

const REFERRER_MAP: Array<{ match: RegExp; source: string }> = [
  { match: /facebook\.com|fb\.com|fb\.watch|messenger/i, source: "facebook" },
  { match: /instagram\.com/i, source: "instagram" },
  { match: /t\.co|twitter\.com|x\.com/i, source: "x" },
  { match: /tiktok\.com/i, source: "tiktok" },
  { match: /youtube\.com|youtu\.be/i, source: "youtube" },
  { match: /reddit\.com/i, source: "reddit" },
  { match: /google\./i, source: "google" },
  { match: /bing\.com/i, source: "bing" },
  { match: /duckduckgo\.com/i, source: "duckduckgo" },
  { match: /pinterest\./i, source: "pinterest" },
];

const clean = (v: string | null | undefined, max = 60) =>
  (v ?? "").trim().toLowerCase().slice(0, max) || null;

/** Editor tracked-link code → clean `?ref=` handle (letters/digits/-/_). */
function refCode(v: string | null): string | null {
  const c = (v ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return c || null;
}

/**
 * Where a hit came from. An editor's own `?ref=<code>` tracked link wins
 * over everything (that's how the office knows "his people came from
 * him"); then UTM tags (what the Facebook post links carry); otherwise
 * the referrer host is mapped to a channel; no referrer (or our own
 * domain) counts as direct.
 */
export function classifyHit(search: string, referrer: string, selfHost: string) {
  const params = new URLSearchParams(search);
  const ref = refCode(params.get("ref"));
  const utmSource = clean(params.get("utm_source"));
  const medium = clean(params.get("utm_medium"));
  const campaign = clean(params.get("utm_campaign"), 80) ?? ref;

  let referrerHost: string | null = null;
  try {
    referrerHost = referrer ? new URL(referrer).hostname.toLowerCase() : null;
  } catch {
    referrerHost = null;
  }
  if (referrerHost === selfHost) referrerHost = null;

  let source = utmSource;
  if (!source && referrerHost) {
    source = REFERRER_MAP.find((r) => r.match.test(referrerHost!))?.source ?? referrerHost;
  }
  // An editor's tracked link is the most specific attribution — it wins.
  if (ref) source = `ref:${ref}`;
  return { source: source ?? "direct", medium: medium ?? (ref ? "referral" : null), campaign, referrerHost };
}

/** Everything the admin Traffic board shows, in one trip. */
export async function getTrafficPulse() {
  const now = Date.now();
  const since7 = new Date(now - 7 * DAY);
  const since14 = new Date(now - 14 * DAY);
  const todayStart = new Date(new Date().toISOString().slice(0, 10));

  const [recent, pageviews7, uniques7, uniquesToday, sources, campaigns, paths, devices, outbound7, outboundMerchants] =
    await Promise.all([
      prisma.pageView.findMany({
        where: { createdAt: { gte: since14 } },
        select: { createdAt: true },
      }),
      prisma.pageView.count({ where: { createdAt: { gte: since7 } } }),
      prisma.pageView.findMany({
        where: { createdAt: { gte: since7 } },
        distinct: ["visitorHash"],
        select: { visitorHash: true },
      }),
      prisma.pageView.findMany({
        where: { createdAt: { gte: todayStart } },
        distinct: ["visitorHash"],
        select: { visitorHash: true },
      }),
      prisma.pageView.groupBy({
        by: ["source"],
        where: { createdAt: { gte: since7 } },
        _count: true,
        orderBy: { _count: { source: "desc" } },
        take: 7,
      }),
      prisma.pageView.groupBy({
        by: ["campaign"],
        where: { createdAt: { gte: since7 }, campaign: { not: null } },
        _count: true,
        orderBy: { _count: { campaign: "desc" } },
        take: 6,
      }),
      prisma.pageView.groupBy({
        by: ["path"],
        where: { createdAt: { gte: since7 } },
        _count: true,
        orderBy: { _count: { path: "desc" } },
        take: 8,
      }),
      prisma.pageView.groupBy({
        by: ["device"],
        where: { createdAt: { gte: since7 } },
        _count: true,
      }),
      prisma.outboundClick.count({ where: { createdAt: { gte: since7 } } }),
      prisma.outboundClick.groupBy({
        by: ["merchant"],
        where: { createdAt: { gte: since7 } },
        _count: true,
        orderBy: { _count: { merchant: "desc" } },
        take: 6,
      }),
    ]);

  const deviceCount = (d: string) => devices.find((x) => x.device === d)?._count ?? 0;
  return {
    pageviews7,
    visitors7: uniques7.length,
    visitorsToday: uniquesToday.length,
    series14: dailySeries(recent.map((r) => r.createdAt), 14),
    sources: sources.map((s) => ({ name: s.source, count: s._count })),
    campaigns: campaigns.map((c) => ({ name: c.campaign ?? "—", count: c._count })),
    paths: paths.map((p) => ({ name: p.path, count: p._count })),
    devices: { mobile: deviceCount("mobile"), desktop: deviceCount("desktop") },
    outbound7,
    outboundMerchants: outboundMerchants.map((m) => ({ name: m.merchant, count: m._count })),
  };
}
