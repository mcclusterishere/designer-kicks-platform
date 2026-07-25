import { prisma } from "./db";
import { getPriceTrack, type TrackPoint } from "./priceHistory";

/**
 * Everything the trade panel needs about one thing you can call.
 *
 * The panel is the centrepiece of the market now, so it has to answer three
 * questions at once without the reader going anywhere: what does this cost,
 * where did that price come from, and what does the room think. Splitting
 * those across a chart page, a catalog page and a separate predictions page
 * is what made the old arrangement feel like three products.
 *
 * Both floors resolve into the same shape. An OG pair's price is live resale;
 * a one-of-one's is the artist's ask, or its last confirmed sale. Different
 * sources, same question — so the panel renders once and works on either
 * side rather than being written twice.
 */

export type Side = "OG" | "CUSTOM";

export type TradeTarget = {
  side: Side;
  id: string;
  /** Stable handle for the URL — a SKU on the OG floor, an id for customs. */
  symbol: string;
  name: string;
  sub: string;
  imageUrl: string | null;
  priceCents: number | null;
  /** What it cost when it started — retail, or the artist's first ask. */
  originCents: number | null;
  originLabel: string;
  originAt: Date | null;
  changePct: number | null;
  track: TrackPoint[];
  /** How the open calls are split right now. The crowd, visible. */
  crowd: { up: number; down: number };
  yourCalls: {
    id: string;
    kind: string;
    direction: string | null;
    predictedCents: number | null;
    horizonDays: number;
    stakeCredits: number;
    basisCents: number;
    resolveAt: Date;
  }[];
};

function pct(from: number | null, to: number | null): number | null {
  if (!from || from <= 0 || !to || to <= 0) return null;
  return Math.round(((to - from) / from) * 100);
}

export async function getTradeTarget(
  side: Side,
  symbol: string,
  userId: string | null
): Promise<TradeTarget | null> {
  if (side === "OG") {
    const shoe = await prisma.catalogShoe.findUnique({
      where: { sku: symbol },
      select: {
        id: true, sku: true, name: true, brand: true, imageUrl: true, releaseDate: true,
        retailPriceCents: true, marketPriceCents: true, ebayNewCents: true,
      },
    });
    if (!shoe) return null;
    const price = shoe.marketPriceCents || shoe.ebayNewCents || null;

    const [crowdUp, crowdDown, yours, track] = await Promise.all([
      prisma.prediction.count({ where: { shoeId: shoe.id, status: "OPEN", direction: "UP" } }),
      prisma.prediction.count({ where: { shoeId: shoe.id, status: "OPEN", direction: "DOWN" } }),
      userId
        ? prisma.prediction.findMany({
            where: { userId, shoeId: shoe.id, status: "OPEN" },
            select: {
              id: true, kind: true, direction: true, predictedCents: true,
              horizonDays: true, stakeCredits: true, basisCents: true, resolveAt: true,
            },
          })
        : Promise.resolve([]),
      getPriceTrack(shoe),
    ]);

    return {
      side: "OG",
      id: shoe.id,
      symbol: shoe.sku,
      name: shoe.name,
      sub: shoe.brand ?? shoe.sku,
      imageUrl: shoe.imageUrl,
      priceCents: price,
      originCents: shoe.retailPriceCents,
      originLabel: "Retail at release",
      originAt: shoe.releaseDate,
      changePct: pct(shoe.retailPriceCents, price),
      track,
      crowd: { up: crowdUp, down: crowdDown },
      yourCalls: yours,
    };
  }

  const piece = await prisma.submission.findFirst({
    where: { id: symbol, status: "APPROVED" },
    select: {
      id: true, title: true, artistName: true, imageUrl: true, createdAt: true,
      askingPriceCents: true,
      sales: {
        where: { status: "CONFIRMED" },
        orderBy: { soldAt: "asc" },
        select: { priceCents: true, soldAt: true },
      },
    },
  });
  if (!piece) return null;

  const lastSale = piece.sales[piece.sales.length - 1] ?? null;
  const price = piece.askingPriceCents || lastSale?.priceCents || null;
  const firstSale = piece.sales[0] ?? null;

  const [crowdUp, crowdDown, yours] = await Promise.all([
    prisma.prediction.count({ where: { submissionId: piece.id, status: "OPEN", direction: "UP" } }),
    prisma.prediction.count({ where: { submissionId: piece.id, status: "OPEN", direction: "DOWN" } }),
    userId
      ? prisma.prediction.findMany({
          where: { userId, submissionId: piece.id, status: "OPEN" },
          select: {
            id: true, kind: true, direction: true, predictedCents: true,
            horizonDays: true, stakeCredits: true, basisCents: true, resolveAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  // A one-of-one's history is its sale record: every confirmed sale is a
  // real observation, and the current ask closes the line. No daily
  // sampling to draw from, and none invented.
  const track: TrackPoint[] = piece.sales.map((s) => ({
    at: s.soldAt,
    cents: s.priceCents,
    kind: "recorded" as const,
  }));
  if (price && (!lastSale || lastSale.priceCents !== price)) {
    track.push({ at: new Date(), cents: price, kind: "live" });
  }

  return {
    side: "CUSTOM",
    id: piece.id,
    symbol: piece.id,
    name: piece.title,
    sub: piece.artistName,
    imageUrl: piece.imageUrl,
    priceCents: price,
    originCents: firstSale?.priceCents ?? null,
    originLabel: firstSale ? "First sale" : "No sale on record yet",
    originAt: firstSale?.soldAt ?? piece.createdAt,
    changePct: pct(firstSale?.priceCents ?? null, price),
    track,
    crowd: { up: crowdUp, down: crowdDown },
    yourCalls: yours,
  };
}
