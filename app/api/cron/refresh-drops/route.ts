import { NextRequest, NextResponse } from "next/server";
import { refreshDropDates } from "@/lib/dropRefresh";

/**
 * Scheduled drop-date sync. Walks every article carrying a style code
 * (SKU), asks the sneaker-API waterfall for its release date, and updates
 * the free calendar when a trustworthy source moved the date.
 *
 * Dormant until a provider key is set (KICKSDB_KEY / RAPIDAPI_STOCKX_KEY /
 * APIFY_TOKEN) — with none configured it returns immediately, zero calls.
 *
 * Schedule it daily (cached resale data is fine 24h old for a calendar).
 * Protect it with CRON_SECRET: any scheduler sends it as a bearer token.
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://theheatchart.com/api/cron/refresh-drops
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await refreshDropDates();
  return NextResponse.json(summary);
}
