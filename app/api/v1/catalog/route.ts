import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiResponse, apiOptions, paging } from "@/lib/publicApi";
import { siteUrl } from "@/lib/articles";

export const dynamic = "force-dynamic";

/** OG retail releases with live market value — the catalog side. */
export async function GET(req: NextRequest) {
  const { limit, offset } = paging(req);
  const p = req.nextUrl.searchParams;
  const brand = p.get("brand");
  const q = p.get("q");

  const where = {
    ...(brand ? { brand: { equals: brand, mode: "insensitive" as const } } : {}),
    ...(q
      ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { sku: { contains: q, mode: "insensitive" as const } }] }
      : {}),
  };

  const [total, shoes] = await Promise.all([
    prisma.catalogShoe.count({ where }),
    prisma.catalogShoe.findMany({
      where,
      orderBy: [{ marketPriceCents: { sort: "desc", nulls: "last" } }, { name: "asc" }],
      skip: offset,
      take: limit,
      select: {
        sku: true, name: true, brand: true, silhouette: true, colorway: true,
        imageUrl: true, retailPriceCents: true, marketPriceCents: true,
        releaseDate: true, gender: true, updatedAt: true,
      },
    }),
  ]);

  return apiResponse(req, {
    total,
    count: shoes.length,
    offset,
    catalog: shoes.map((s) => ({
      sku: s.sku,
      name: s.name,
      brand: s.brand,
      silhouette: s.silhouette,
      colorway: s.colorway,
      image: s.imageUrl,
      retailUsd: s.retailPriceCents !== null ? s.retailPriceCents / 100 : null,
      marketUsd: s.marketPriceCents !== null ? s.marketPriceCents / 100 : null,
      premiumPct:
        s.retailPriceCents && s.marketPriceCents && s.retailPriceCents > 0
          ? Math.round(((s.marketPriceCents - s.retailPriceCents) / s.retailPriceCents) * 100)
          : null,
      releaseDate: s.releaseDate,
      lane: s.gender,
      url: `${siteUrl()}/catalog/${encodeURIComponent(s.sku)}`,
      priceUpdatedAt: s.updatedAt,
    })),
  });
}

export function OPTIONS() {
  return apiOptions();
}
