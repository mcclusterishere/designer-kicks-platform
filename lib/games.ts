import { prisma } from "./db";

/**
 * The shoe pool both arcade mini-games run on. A shoe qualifies when it
 * has a photo AND a dollar value — live resale price when we have it,
 * retail as the fallback so the games work even before the market-price
 * backfill runs in prod. Ordered by updatedAt so the nightly catalog
 * refresh naturally rotates which shoes surface over time.
 */
export type GameShoe = {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string;
  valueCents: number;
  isMarket: boolean; // value is resale (true) vs retail fallback (false)
};

export async function getGamePool(limit = 300): Promise<GameShoe[]> {
  const rows = await prisma.catalogShoe.findMany({
    where: {
      imageUrl: { not: null },
      OR: [{ marketPriceCents: { not: null } }, { retailPriceCents: { not: null } }],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true, name: true, brand: true, imageUrl: true,
      marketPriceCents: true, retailPriceCents: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    imageUrl: r.imageUrl!,
    valueCents: (r.marketPriceCents ?? r.retailPriceCents)!,
    isMarket: r.marketPriceCents != null,
  }));
}
