import { prisma } from "./db";

/**
 * Per-pair price history.
 *
 * Nobody sells retroactive daily sneaker pricing for free, and the public
 * StockX/GOAT APIs are gone — so the only honest way to get a chart is to
 * start recording the market now and never miss a day. Every sync writes
 * one row per source per UTC day; re-running the same day overwrites
 * rather than duplicating, so the series stays clean.
 */

export type Source = "ebay_new" | "ebay_used" | "market";

function utcDay(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Write today's observations for one shoe. Nulls are skipped, not zeroed. */
export async function recordPrices(
  shoeId: string,
  prices: Partial<Record<Source, number | null>>
): Promise<number> {
  const at = utcDay();
  let written = 0;
  for (const [source, cents] of Object.entries(prices)) {
    if (!cents || cents <= 0) continue;
    await prisma.priceSnapshot
      .upsert({
        where: { shoeId_source_at: { shoeId, source, at } },
        create: { shoeId, source, cents, at },
        update: { cents },
      })
      .then(() => written++)
      .catch(() => {});
  }
  return written;
}

/** Sweep the catalog's current market prices into today's history. */
export async function snapshotMarketPrices(limit = 500): Promise<{ shoes: number; points: number }> {
  const shoes = await prisma.catalogShoe.findMany({
    where: { marketPriceCents: { gt: 0 } },
    select: { id: true, marketPriceCents: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  let points = 0;
  for (const s of shoes) points += await recordPrices(s.id, { market: s.marketPriceCents });
  return { shoes: shoes.length, points };
}

export type SeriesPoint = { at: Date; market: number | null; ebayNew: number | null; ebayUsed: number | null };

/** The recorded series for one pair, oldest → newest, one point per day. */
export async function getPriceSeries(shoeId: string, days = 365): Promise<SeriesPoint[]> {
  const since = new Date(Date.now() - days * 86400000);
  const rows = await prisma.priceSnapshot.findMany({
    where: { shoeId, at: { gte: since } },
    orderBy: { at: "asc" },
    select: { at: true, source: true, cents: true },
  });
  const byDay = new Map<number, SeriesPoint>();
  for (const r of rows) {
    const k = r.at.getTime();
    const p = byDay.get(k) ?? { at: r.at, market: null, ebayNew: null, ebayUsed: null };
    if (r.source === "market") p.market = r.cents;
    else if (r.source === "ebay_new") p.ebayNew = r.cents;
    else if (r.source === "ebay_used") p.ebayUsed = r.cents;
    byDay.set(k, p);
  }
  return [...byDay.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
}

export type TrackPoint = { at: Date; cents: number; kind: "retail" | "recorded" | "live" };

/**
 * One pair's price track, anchored at its drop.
 *
 * The daily log only knows what it has recorded since we switched it on,
 * which on a young install is a single point — nothing to draw. But two
 * more points are known facts rather than guesses: on release day the pair
 * cost retail, by definition, and right now it trades at the price on the
 * board. Anchoring on those means every pair with a release date and a
 * retail price has a real chart from day one, and the recorded readings
 * fill in the middle as they accumulate.
 *
 * Each point is labelled with where it came from, so the chart can show
 * the difference between an observation and an anchor instead of quietly
 * blending them into one line.
 */
export async function getPriceTrack(shoe: {
  id: string;
  retailPriceCents: number | null;
  marketPriceCents: number | null;
  ebayNewCents: number | null;
  releaseDate: Date | null;
}): Promise<TrackPoint[]> {
  const points: TrackPoint[] = [];

  if (shoe.releaseDate && shoe.retailPriceCents && shoe.retailPriceCents > 0) {
    points.push({ at: shoe.releaseDate, cents: shoe.retailPriceCents, kind: "retail" });
  }

  for (const p of await getPriceSeries(shoe.id)) {
    const cents = p.market ?? p.ebayNew ?? p.ebayUsed;
    if (cents && cents > 0) points.push({ at: p.at, cents, kind: "recorded" });
  }

  const live = shoe.marketPriceCents || shoe.ebayNewCents;
  if (live && live > 0) {
    const last = points[points.length - 1];
    // Only add "now" if the newest recorded reading isn't already today's.
    const sameDay = last && last.at.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
    if (!sameDay) points.push({ at: new Date(), cents: live, kind: "live" });
  }

  return points.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Return since release — computable TODAY without any history, because
 * both ends are known facts: what it cost at retail on drop day, and what
 * it trades for now. This is the honest "how has it done" number while the
 * daily curve is still filling in.
 */
export function sinceRelease(retailCents: number | null, lastCents: number | null, releaseDate: Date | null) {
  if (!retailCents || retailCents <= 0 || !lastCents || lastCents <= 0) return null;
  const pct = Math.round(((lastCents - retailCents) / retailCents) * 100);
  const days = releaseDate ? Math.max(1, Math.floor((Date.now() - releaseDate.getTime()) / 86400000)) : null;
  // Annualised only when we actually know the release date and it's aged
  // at least a month — anything shorter annualises into nonsense.
  const annualisedPct = days && days >= 30 ? Math.round((pct / days) * 365) : null;
  return { pct, days, annualisedPct };
}
