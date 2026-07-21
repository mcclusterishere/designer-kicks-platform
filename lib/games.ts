import { prisma } from "./db";

/**
 * The shoe pool both arcade mini-games run on. A shoe qualifies when it
 * has a photo AND a dollar value — live resale price when we have it,
 * retail as the fallback so the games work even before the market-price
 * backfill runs in prod.
 *
 * Sampled with ORDER BY random() at the database, NOT by recency —
 * ordering by updatedAt made every deck a wall of whatever brand the
 * last bulk import touched. Random sampling keeps the deck mixed no
 * matter what was imported five minutes ago.
 */
export type GameShoe = {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string;
  valueCents: number;
  isMarket: boolean; // value is resale (true) vs retail fallback (false)
};

type Row = {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string;
  marketPriceCents: number | null;
  retailPriceCents: number | null;
};

export async function getGamePool(limit = 300): Promise<GameShoe[]> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, name, brand, "imageUrl", "marketPriceCents", "retailPriceCents"
    FROM "CatalogShoe"
    WHERE "imageUrl" IS NOT NULL
      AND ("marketPriceCents" IS NOT NULL OR "retailPriceCents" IS NOT NULL)
    ORDER BY random()
    LIMIT ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    imageUrl: r.imageUrl,
    valueCents: (r.marketPriceCents ?? r.retailPriceCents)!,
    isMarket: r.marketPriceCents != null,
  }));
}
