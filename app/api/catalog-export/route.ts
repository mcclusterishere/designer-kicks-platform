import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

/**
 * Admin-only catalog export — the knowledge base as a CSV, filterable by
 * brand or search, for feeding external research tools (NotebookLM,
 * Gemini, spreadsheets) and building article slates from real data.
 *
 *   /api/catalog-export                → everything
 *   /api/catalog-export?brand=Jordan   → one brand
 *   /api/catalog-export?q=dunk         → name/sku/colorway search
 */

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin only." }, { status: 401 });
  }

  const brand = (req.nextUrl.searchParams.get("brand") ?? "").trim().slice(0, 40);
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);

  const shoes = await prisma.catalogShoe.findMany({
    where: {
      ...(brand ? { brand: { equals: brand, mode: "insensitive" } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { colorway: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ brand: "asc" }, { releaseDate: { sort: "desc", nulls: "last" } }],
    select: {
      sku: true, name: true, brand: true, silhouette: true, colorway: true,
      gender: true, retailPriceCents: true, marketPriceCents: true,
      releaseDate: true, imageUrl: true,
    },
  });

  const header = "sku,name,brand,silhouette,colorway,lane,retail_usd,market_usd,release_date,image_url";
  const lines = shoes.map((s) =>
    [
      csvCell(s.sku),
      csvCell(s.name),
      csvCell(s.brand),
      csvCell(s.silhouette),
      csvCell(s.colorway),
      csvCell(s.gender),
      csvCell(s.retailPriceCents ? Math.round(s.retailPriceCents / 100) : null),
      csvCell(s.marketPriceCents ? Math.round(s.marketPriceCents / 100) : null),
      csvCell(s.releaseDate ? s.releaseDate.toISOString().slice(0, 10) : null),
      csvCell(s.imageUrl),
    ].join(",")
  );
  const csv = [header, ...lines].join("\n");
  const label = brand || q || "all";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="heat-chart-catalog-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
