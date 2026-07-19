import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { merchantForUrl, tagUrl } from "@/lib/affiliates";
import { isBot, visitorHash } from "@/lib/traffic";
import { allowAttempt } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Outbound purchase redirect: /go?u=<merchant url>&ref=<where on site>.
// Only known merchant hosts pass (this is NOT an open redirect —
// anything else bounces home), the configured affiliate tag is
// applied, and the click is logged before the 302.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const ref = (req.nextUrl.searchParams.get("ref") ?? "").slice(0, 120) || null;

  const merchant = merchantForUrl(u);
  if (!merchant) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }
  const target = tagUrl(u, merchant);

  const ua = req.headers.get("user-agent") ?? "";
  if (ua && !isBot(ua)) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    // Cap click-logging per visitor so a scripted client can't bloat the
    // table — the redirect below still happens either way.
    if (allowAttempt("go", ip, 120, 60 * 1000)) {
      // Fire-and-forget: a logging hiccup must never block the shopper.
      prisma.outboundClick
        .create({
          data: {
            merchant: merchant.key,
            url: target.slice(0, 800),
            ref,
            visitorHash: visitorHash(ip, ua),
          },
        })
        .catch(() => {});
    }
  }

  return NextResponse.redirect(target, 302);
}
