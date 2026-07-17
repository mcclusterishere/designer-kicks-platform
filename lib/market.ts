import { prisma } from "./db";

export type MarketItem = {
  id: string;
  title: string;
  baseShoe: string;
  category: string;
  imageUrl: string;
  artistName: string;
  artistSlug: string | null;
  ownerName: string | null;
  ownerSlug: string | null;
  lastSaleCents: number | null;
  lastSaleVerified: boolean;
  lastSaleAt: Date | null;
  askCents: number | null;
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
        OR: [{ askingPriceCents: { not: null } }, { sales: { some: { status: "CONFIRMED" } } }],
      },
      include: {
        artist: { select: { slug: true, displayName: true, status: true } },
        owner: { select: { name: true, collectorSlug: true } },
        sales: {
          where: { status: "CONFIRMED" },
          orderBy: { soldAt: "desc" },
          take: 1,
        },
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
        imageUrl: p.imageUrl,
        artistName: p.artist?.displayName ?? p.artistName,
        artistSlug: p.artist?.status === "APPROVED" ? p.artist.slug : null,
        ownerName: p.owner?.name ?? null,
        ownerSlug: p.owner?.collectorSlug ?? null,
        lastSaleCents: last?.priceCents ?? null,
        lastSaleVerified: last?.verified ?? false,
        lastSaleAt: last?.soldAt ?? null,
        askCents: p.askingPriceCents,
      };
    })
    .sort(
      (a, b) =>
        (b.lastSaleCents ?? b.askCents ?? 0) - (a.lastSaleCents ?? a.askCents ?? 0)
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
