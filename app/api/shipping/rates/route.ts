import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { allowAttempt } from "@/lib/ratelimit";
import { getShippingRates, shippingConfigured } from "@/lib/shipping";

export const dynamic = "force-dynamic";

/**
 * Live shipping quote for members with a sale in motion. Members-only
 * (it proxies a paid API) and rate-limited per user.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, detail: "Sign in to quote shipping." }, { status: 401 });
  }
  if (!allowAttempt("shipquote", session.user.id, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, detail: "Quote limit reached — try again in an hour." }, { status: 429 });
  }

  if (!shippingConfigured()) {
    return NextResponse.json({ ok: false, configured: false, detail: "Shipping not connected yet." });
  }

  const p = req.nextUrl.searchParams;
  const result = await getShippingRates({
    fromZip: p.get("from") ?? "",
    toZip: p.get("to") ?? "",
  });
  return NextResponse.json(
    result.ok ? { ...result, configured: true } : { ...result, configured: true },
    { status: result.ok ? 200 : 400 }
  );
}
