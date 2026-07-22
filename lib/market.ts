import { prisma } from "./db";
import { computeHeatIndex, heatSeries, pieceHeatEvents, type HeatIndexValue } from "./heatIndex";

export type MarketItem = {
  id: string;
  title: string;
  baseShoe: string;
  category: string;
  size: string | null;
  imageUrl: string;
  artistName: string;
  artistSlug: string | null;
  collabWith: { name: string; slug: string }[];
  ownerName: string | null;
  ownerSlug: string | null;
  lastSaleCents: number | null;
  prevSaleCents: number | null;
  lastSaleVerified: boolean;
  lastSaleAt: Date | null;
  askCents: number | null;
  topOfferCents: number | null;
  bidCount: number;
  hx: HeatIndexValue;
  /** Weekly HX samples, oldest → newest — the honest sparkline. */
  series: number[];
  provenanceType: string;
  consignment: { floorCents: number; priorSaleCents: number | null } | null;
};

export type MarketStats = {
  volumeCents: number;
  salesCount: number;
  avgCents: number;
  verifiedCount: number;
};

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * The market board: every piece with a confirmed sale or an open ask,
 * plus index stats across all confirmed sales. StockX energy, custom
 * one-of-ones only — no payment rails yet, asks are display-only.
 */
export async function getMarketBoard(): Promise<{ items: MarketItem[]; stats: MarketStats }> {
  const [pieces, confirmed] = await Promise.all([
    prisma.submission.findMany({
      where: {
        status: "APPROVED",
        OR: [
          { askingPriceCents: { not: null } },
          { sales: { some: { status: "CONFIRMED" } } },
          { offers: { some: { status: "OPEN" } } },
        ],
      },
      include: {
        artist: { select: { slug: true, displayName: true, status: true } },
        collaborators: { where: { status: "APPROVED" }, select: { slug: true, displayName: true } },
        owner: { select: { name: true, collectorSlug: true } },
        sales: {
          where: { status: "CONFIRMED" },
          orderBy: { soldAt: "desc" }, // [0]=last, [1]=previous; all feed the HX
        },
        offers: {
          where: { status: "OPEN" },
          orderBy: { amountCents: "desc" }, // full open book — count + high bid + HX demand points
        },
        // Timestamped activity that moves the Heat Index.
        votes: { select: { createdAt: true } },
        battlesWon: { select: { createdAt: true } },
        tournamentsWon: { select: { createdAt: true } },
        ratings: { select: { stars: true, createdAt: true } },
        consignment: { select: { status: true, floorCents: true, priorSaleCents: true } },
      },
    }),
    prisma.sale.findMany({ where: { status: "CONFIRMED" } }),
  ]);

  const items: MarketItem[] = pieces
    .map((p) => {
      const last = p.sales[0] ?? null;
      return {
        id: p.id,
        title: p.title,
        baseShoe: p.baseShoe,
        category: p.category,
        size: p.size,
        imageUrl: p.imageUrl,
        artistName: p.artist?.displayName ?? p.artistName,
        artistSlug: p.artist?.status === "APPROVED" ? p.artist.slug : null,
        collabWith: p.collaborators.map((c) => ({ name: c.displayName, slug: c.slug })),
        ownerName: p.owner?.name ?? null,
        ownerSlug: p.owner?.collectorSlug ?? null,
        lastSaleCents: last?.priceCents ?? null,
        prevSaleCents: p.sales[1]?.priceCents ?? null,
        lastSaleVerified: last?.verified ?? false,
        lastSaleAt: last?.soldAt ?? null,
        askCents: p.askingPriceCents,
        topOfferCents: p.offers[0]?.amountCents ?? null,
        bidCount: p.offers.length,
        provenanceType: p.provenanceType,
        consignment:
          p.consignment?.status === "OPEN"
            ? { floorCents: p.consignment.floorCents, priorSaleCents: p.consignment.priorSaleCents }
            : null,
        ...(() => {
          const events = pieceHeatEvents({
            votes: p.votes,
            battlesWon: p.battlesWon,
            tournamentsWon: p.tournamentsWon,
            ratings: p.ratings,
            openOffers: p.offers,
            confirmedSales: p.sales,
          });
          return { hx: computeHeatIndex(events), series: heatSeries(events) };
        })(),
      };
    })
    .sort(
      (a, b) =>
        (b.lastSaleCents ?? b.askCents ?? b.topOfferCents ?? 0) -
        (a.lastSaleCents ?? a.askCents ?? a.topOfferCents ?? 0)
    );

  const volumeCents = confirmed.reduce((sum, s) => sum + s.priceCents, 0);
  const stats: MarketStats = {
    volumeCents,
    salesCount: confirmed.length,
    avgCents: confirmed.length > 0 ? Math.round(volumeCents / confirmed.length) : 0,
    verifiedCount: confirmed.filter((s) => s.verified).length,
  };

  return { items, stats };
}

export type OgItem = {
  sku: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  retailCents: number | null;
  marketCents: number;
  premiumPct: number | null; // resale vs retail, e.g. +142 / -12
  // The eBay legs of the spread — live medians from the auto-matcher.
  ebayNewCents: number | null;
  ebayUsedCents: number | null;
  releaseDate: Date | null;
};

export type OgStats = {
  tracked: number;
  avgPremiumPct: number | null;
  topGainer: OgItem | null;
};

/**
 * The OG side of the market switch: real retail releases from the
 * catalog knowledge base, priced by live resale data captured at
 * import. Premium = how far above (or below) retail the street values
 * the pair — the number StockX built a business on.
 */
export async function getOgBoard(): Promise<{ items: OgItem[]; stats: OgStats; brands: string[] }> {
  const shoes = await prisma.catalogShoe.findMany({
    // No photo, no board seat — a blank tile costs more credibility
    // than the listing is worth.
    where: { marketPriceCents: { not: null, gt: 0 }, imageUrl: { not: null } },
    orderBy: { marketPriceCents: "desc" },
    select: {
      sku: true, name: true, brand: true, imageUrl: true,
      retailPriceCents: true, marketPriceCents: true, releaseDate: true,
      ebayNewCents: true, ebayUsedCents: true,
    },
  });

  const items: OgItem[] = shoes.map((s) => ({
    sku: s.sku,
    name: s.name,
    brand: s.brand,
    imageUrl: s.imageUrl,
    retailCents: s.retailPriceCents,
    marketCents: s.marketPriceCents!,
    premiumPct:
      s.retailPriceCents && s.retailPriceCents > 0
        ? Math.round(((s.marketPriceCents! - s.retailPriceCents) / s.retailPriceCents) * 100)
        : null,
    ebayNewCents: s.ebayNewCents,
    ebayUsedCents: s.ebayUsedCents,
    releaseDate: s.releaseDate,
  }));

  const withPremium = items.filter((i) => i.premiumPct !== null);
  const stats: OgStats = {
    tracked: items.length,
    avgPremiumPct: withPremium.length
      ? Math.round(withPremium.reduce((s, i) => s + (i.premiumPct ?? 0), 0) / withPremium.length)
      : null,
    topGainer: withPremium.length
      ? withPremium.reduce((top, i) => ((i.premiumPct ?? 0) > (top.premiumPct ?? 0) ? i : top))
      : null,
  };

  const brands = [...new Set(items.map((i) => i.brand).filter((b): b is string => Boolean(b)))].sort();
  return { items, stats, brands };
}

export type HotBase = {
  silhouette: string;
  customsBuilt: number;
  recentBuilds: number; // last 30 days — what's popping NOW
  avgCustomAskCents: number | null;
};

/**
 * The Hot Bases rail — which silhouettes the CULTURE is actually
 * building on. Base-model demand data (eBay/KicksDB prices) says what
 * pairs cost; this says what pairs get chosen. The blend is the
 * algorithm: customs-built count ranks it, recent builds break ties,
 * and the average custom ask shows what the work turns the base into.
 */
export async function getHotBases(limit = 8): Promise<HotBase[]> {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const pieces = await prisma.submission.findMany({
    where: { status: "APPROVED", silhouette: { not: null }, category: "sneakers" },
    select: { silhouette: true, createdAt: true, askingPriceCents: true },
  });

  const bySilhouette = new Map<string, { total: number; recent: number; asks: number[] }>();
  for (const p of pieces) {
    const key = p.silhouette!.trim();
    if (!key) continue;
    const entry = bySilhouette.get(key) ?? { total: 0, recent: 0, asks: [] };
    entry.total += 1;
    if (p.createdAt >= monthAgo) entry.recent += 1;
    if (p.askingPriceCents) entry.asks.push(p.askingPriceCents);
    bySilhouette.set(key, entry);
  }

  return [...bySilhouette.entries()]
    .map(([silhouette, e]) => ({
      silhouette,
      customsBuilt: e.total,
      recentBuilds: e.recent,
      avgCustomAskCents: e.asks.length
        ? Math.round(e.asks.reduce((s, a) => s + a, 0) / e.asks.length)
        : null,
    }))
    .sort((a, b) => b.customsBuilt - a.customsBuilt || b.recentBuilds - a.recentBuilds)
    .slice(0, limit);
}
