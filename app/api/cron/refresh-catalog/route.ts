import { NextRequest, NextResponse } from "next/server";
import { refreshCatalogPricing } from "@/lib/catalog";
import { syncEbayPrices } from "@/lib/ebay";

/**
 * Scheduled catalog refresher. Re-imports a rotating handful of brands
 * from the provider each run, so live market prices, photos, and
 * shopping lanes stay current across the whole base without manual
 * re-imports. Dormant without KICKSDB_KEY — returns immediately.
 *
 * Schedule it daily alongside refresh-drops, same bearer token:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://theheatchart.com/api/cron/refresh-catalog
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await refreshCatalogPricing();
  // Same tick keeps the eBay legs of the spread matched — a rotating
  // batch per run covers the whole catalog across days. Dormant
  // without eBay keys.
  const ebay = await syncEbayPrices().catch(() => ({ configured: true, checked: 0, matched: 0 }));
  return NextResponse.json({ ...summary, ebay });
}
