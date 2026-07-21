import { NextRequest } from "next/server";
import { getMarketBoard } from "@/lib/market";
import { apiResponse, apiOptions, mediaUrl } from "@/lib/publicApi";
import { siteUrl } from "@/lib/articles";

export const dynamic = "force-dynamic";

/** The customs pricing index — the numbers behind the Market tab. */
export async function GET(req: NextRequest) {
  const { items, stats } = await getMarketBoard();
  return apiResponse(req, {
    stats: {
      totalVolumeUsd: stats.volumeCents / 100,
      salesRecorded: stats.salesCount,
      averageSaleUsd: stats.salesCount ? Math.round(stats.avgCents / 100) : null,
      verifiedSales: stats.verifiedCount,
      listed: items.length,
    },
    board: items.map((i) => ({
      id: i.id,
      title: i.title,
      artist: i.artistName,
      artistUrl: i.artistSlug ? `${siteUrl()}/artists/${i.artistSlug}` : null,
      collabWith: i.collabWith.map((c) => c.name),
      category: i.category,
      base: i.baseShoe,
      size: i.size,
      image: mediaUrl(i.imageUrl),
      askUsd: i.askCents !== null ? i.askCents / 100 : null,
      lastSaleUsd: i.lastSaleCents !== null ? i.lastSaleCents / 100 : null,
      previousSaleUsd: i.prevSaleCents !== null ? i.prevSaleCents / 100 : null,
      lastSaleVerified: i.lastSaleVerified,
      lastSaleAt: i.lastSaleAt,
      topOpenOfferUsd: i.topOfferCents !== null ? i.topOfferCents / 100 : null,
    })),
  });
}

export function OPTIONS() {
  return apiOptions();
}
