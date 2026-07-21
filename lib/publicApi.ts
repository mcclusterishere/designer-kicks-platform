import { NextRequest, NextResponse } from "next/server";
import { allowAttempt } from "./ratelimit";
import { siteUrl } from "./articles";
import { absoluteMediaUrl } from "./social";

/**
 * The Heat Chart public API — our database, published. KicksDB has
 * theirs; this is ours: the only structured feed of one-of-one custom
 * pieces, the artists behind them, and what the culture actually pays.
 * Read-only, CORS-open, attribution required. Third parties (price
 * aggregators, KicksDB, researchers) pull straight from these routes.
 */

export const API_VERSION = "v1";

export function apiResponse(
  req: NextRequest,
  data: unknown,
  init?: { status?: number }
): NextResponse {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  // Generous public ceiling — enough for any honest integration to poll,
  // low enough that a scraper loop gets told to cache instead.
  if (!allowAttempt("public-api", ip, 120, 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "Rate limit: 120 requests/minute. Responses cache for 5 minutes — you don't need more." },
      { status: 429, headers: corsHeaders() }
    );
  }
  return NextResponse.json(
    {
      ok: true,
      source: "The Heat Chart — theheatchart.com",
      docs: `${siteUrl()}/developers`,
      license: "Free to use with attribution and a link back to theheatchart.com.",
      data,
    },
    {
      status: init?.status ?? 200,
      headers: {
        ...corsHeaders(),
        // CDN-cacheable: fresh enough for a market feed, cheap on the box.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function apiOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/** Absolute URL for any media path so consumers can hotlink or mirror. */
export function mediaUrl(url: string | null): string | null {
  return url ? absoluteMediaUrl(url) : null;
}

/** Clamped limit/offset paging from query params. */
export function paging(req: NextRequest, defaultLimit = 50, maxLimit = 200) {
  const p = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(p.get("limit")) || defaultLimit, 1), maxLimit);
  const offset = Math.max(Number(p.get("offset")) || 0, 0);
  return { limit, offset };
}
