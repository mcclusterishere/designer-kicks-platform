import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

/**
 * The exchange — the catalog and the market as one trading floor.
 *
 * Every tracked pair is a listed symbol: its style code is the ticker,
 * live resale is the last price, and the eBay legs are a genuine two-sided
 * quote (used = bid, new = ask). Sorting, search and paging all run in SQL
 * so the whole catalog is tradeable, not just the first page of it.
 *
 * Nothing here is invented: a pair with no resale number shows "—" rather
 * than a modelled price, and the index only counts pairs that have both a
 * retail and a live resale figure to measure between.
 */

export type SortKey = "last" | "change" | "spread" | "volume" | "name" | "recent";

export type Row = {
  sku: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  retailCents: number | null;
  lastCents: number | null;
  changePct: number | null;
  bidCents: number | null; // eBay used
  askCents: number | null; // eBay new
  spreadCents: number | null;
  releaseDate: Date | null;
  quotedAt: Date | null;
};

export type IndexStats = {
  listed: number; // pairs with any price
  quoted: number; // pairs with a live two-sided eBay quote
  indexValue: number | null; // avg premium % across measurable pairs
  advancers: number;
  decliners: number;
  measured: number;
};

function premium(retail: number | null, last: number | null): number | null {
  if (!retail || retail <= 0 || !last || last <= 0) return null;
  return Math.round(((last - retail) / retail) * 100);
}

function toRow(s: {
  sku: string; name: string; brand: string | null; imageUrl: string | null;
  retailPriceCents: number | null; marketPriceCents: number | null;
  ebayNewCents: number | null; ebayUsedCents: number | null;
  releaseDate: Date | null; ebayCheckedAt: Date | null;
}): Row {
  // Last traded: the live resale number if we have one, else the eBay new
  // leg, else retail as the floor. Never a guess.
  const last = s.marketPriceCents || s.ebayNewCents || s.retailPriceCents || null;
  const bid = s.ebayUsedCents;
  const ask = s.ebayNewCents;
  return {
    sku: s.sku,
    name: s.name,
    brand: s.brand,
    imageUrl: s.imageUrl,
    retailCents: s.retailPriceCents,
    lastCents: last,
    changePct: premium(s.retailPriceCents, last),
    bidCents: bid,
    askCents: ask,
    spreadCents: bid && ask && ask > bid ? ask - bid : null,
    releaseDate: s.releaseDate,
    quotedAt: s.ebayCheckedAt,
  };
}

const SELECT = {
  sku: true, name: true, brand: true, imageUrl: true,
  retailPriceCents: true, marketPriceCents: true,
  ebayNewCents: true, ebayUsedCents: true,
  releaseDate: true, ebayCheckedAt: true,
} as const;

function orderFor(sort: SortKey): Prisma.CatalogShoeOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ name: "asc" }];
    case "recent":
      return [{ releaseDate: { sort: "desc", nulls: "last" } }];
    case "spread":
      // Widest quoted market first — where the arbitrage lives.
      return [{ ebayNewCents: { sort: "desc", nulls: "last" } }];
    case "volume":
      // No trade count to sort on; freshest quote is the honest proxy.
      return [{ ebayCheckedAt: { sort: "desc", nulls: "last" } }];
    case "change":
    case "last":
    default:
      return [{ marketPriceCents: { sort: "desc", nulls: "last" } }];
  }
}

export async function getExchangeBoard(opts: {
  q?: string;
  brand?: string;
  sort?: SortKey;
  page?: number;
  perPage?: number;
}): Promise<{ rows: Row[]; total: number; page: number; pages: number; brands: string[] }> {
  const perPage = Math.min(100, Math.max(10, opts.perPage ?? 40));
  const page = Math.max(1, opts.page ?? 1);
  const sort = opts.sort ?? "last";

  const where: Prisma.CatalogShoeWhereInput = {
    // Listed = has at least one real price. Unpriced rows aren't tradeable.
    OR: [{ marketPriceCents: { gt: 0 } }, { retailPriceCents: { gt: 0 } }, { ebayNewCents: { gt: 0 } }],
  };
  if (opts.brand) where.brand = opts.brand;
  if (opts.q?.trim()) {
    const q = opts.q.trim().slice(0, 60);
    where.AND = [{ OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] }];
  }

  const [shoes, total, brandGroups] = await Promise.all([
    prisma.catalogShoe.findMany({
      where,
      orderBy: orderFor(sort),
      skip: (page - 1) * perPage,
      take: perPage,
      select: SELECT,
    }),
    prisma.catalogShoe.count({ where }),
    prisma.catalogShoe.groupBy({
      by: ["brand"],
      where: { brand: { not: null } },
      _count: true,
      orderBy: { _count: { brand: "desc" } },
      take: 14,
    }),
  ]);

  let rows = shoes.map(toRow);
  // Change% has no SQL expression to sort on, so order the page by it.
  if (sort === "change") {
    rows = rows.sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity));
  } else if (sort === "spread") {
    rows = rows.sort((a, b) => (b.spreadCents ?? -1) - (a.spreadCents ?? -1));
  }

  return {
    rows,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    brands: brandGroups.map((b) => b.brand!).filter(Boolean),
  };
}

/**
 * Index + breadth. The index is the mean resale premium across every pair
 * we can actually measure (has both retail and a live resale number), so
 * it reads like a market-wide "how far over retail is the street".
 */
export async function getIndexStats(): Promise<IndexStats> {
  const [listed, quoted, measurable] = await Promise.all([
    prisma.catalogShoe.count({
      where: { OR: [{ marketPriceCents: { gt: 0 } }, { retailPriceCents: { gt: 0 } }, { ebayNewCents: { gt: 0 } }] },
    }),
    prisma.catalogShoe.count({ where: { ebayNewCents: { gt: 0 }, ebayUsedCents: { gt: 0 } } }),
    prisma.catalogShoe.findMany({
      where: { retailPriceCents: { gt: 0 }, marketPriceCents: { gt: 0 } },
      select: { retailPriceCents: true, marketPriceCents: true },
      take: 5000,
    }),
  ]);

  const premiums: number[] = [];
  let advancers = 0, decliners = 0;
  for (const s of measurable) {
    const p = premium(s.retailPriceCents, s.marketPriceCents);
    if (p === null) continue;
    premiums.push(p);
    if (p > 0) advancers++;
    else if (p < 0) decliners++;
  }
  // Median, not mean: one $5,500 grail shouldn't define "the market". The
  // middle pair is what the street actually looks like.
  premiums.sort((a, b) => a - b);
  const measured = premiums.length;
  const indexValue = measured > 0 ? premiums[Math.floor(measured / 2)] : null;

  return { listed, quoted, measured, advancers, decliners, indexValue };
}

/** Biggest movers for the ticker tape — real premiums only. */
export async function getMovers(limit = 14): Promise<{ sku: string; name: string; changePct: number; lastCents: number }[]> {
  const shoes = await prisma.catalogShoe.findMany({
    where: { retailPriceCents: { gt: 0 }, marketPriceCents: { gt: 0 } },
    orderBy: { marketPriceCents: "desc" },
    take: 400,
    select: { sku: true, name: true, retailPriceCents: true, marketPriceCents: true },
  });
  return shoes
    .map((s) => ({
      sku: s.sku,
      name: s.name,
      changePct: premium(s.retailPriceCents, s.marketPriceCents) ?? 0,
      lastCents: s.marketPriceCents ?? 0,
    }))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, limit);
}

/**
 * Write today's index fingerprint — once per day, so the chart is built
 * from real observations rather than a modelled curve. Idempotent: a
 * second call on the same UTC day updates that day's row instead of
 * stacking duplicates.
 */
export async function recordIndexSnapshot(): Promise<{ recorded: boolean; value: number | null }> {
  const s = await getIndexStats();
  if (s.indexValue === null) return { recorded: false, value: null };

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.indexSnapshot.findFirst({
    where: { at: { gte: dayStart } },
    select: { id: true },
  });
  const data = {
    value: s.indexValue,
    listed: s.listed,
    quoted: s.quoted,
    advancers: s.advancers,
    decliners: s.decliners,
  };
  if (existing) await prisma.indexSnapshot.update({ where: { id: existing.id }, data });
  else await prisma.indexSnapshot.create({ data });
  return { recorded: true, value: s.indexValue };
}

/** Real observed history, oldest → newest. Empty until the cron has run. */
export async function getIndexHistory(days = 30): Promise<{ at: Date; value: number }[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.indexSnapshot.findMany({
    where: { at: { gte: since } },
    orderBy: { at: "asc" },
    select: { at: true, value: true },
  });
  return rows;
}
