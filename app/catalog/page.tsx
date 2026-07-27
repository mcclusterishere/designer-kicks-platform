import { redirect } from "next/navigation";

/**
 * The catalog is a view of the market, not a separate place, so it now
 * lives at /market?board=catalog alongside the chart, the book and the
 * customs floor.
 *
 * This redirect stays permanently: every link already in the wild — search
 * results, shared URLs, the drop posts — carries its search, brand, lane
 * and page through to the merged tab rather than dumping people on a
 * generic board.
 *
 * Per-shoe pages at /catalog/[sku] are untouched; they're the SEO surface.
 */
export const dynamic = "force-dynamic";

export default async function CatalogIndexRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string; g?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams({ board: "catalog" });
  for (const k of ["q", "brand", "page", "g"] as const) {
    const v = sp[k]?.trim();
    if (v) params.set(k, v);
  }
  redirect(`/market?${params.toString()}`);
}
