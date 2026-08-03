import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { merchantForUrl, tagUrl } from "@/lib/affiliates";
import { isBot, visitorHash } from "@/lib/traffic";
import { allowAttempt } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Did a person on our site click this, or did something arrive at the
 * redirect cold?
 *
 * The user-agent check above catches anything that admits to being a
 * bot. It does not catch what is actually hitting this route: a spread
 * of datacentre IPs all presenting an identical, entirely ordinary
 * Chrome string, one request each, so the per-IP cap never trips either.
 * They give themselves away by never fetching a stylesheet — they read
 * the HTML and follow the outbound link, which is a scraper, not a
 * shopper.
 *
 * A real buyer always arrives here from a page of ours, so the referrer
 * is the signal that survives a forged user-agent. Undercounting a
 * privacy-hardened browser that strips the header is the cost, and it is
 * the right side to err on: a missing click lowers every product
 * equally, while a bot's click lands wherever it happened to crawl and
 * quietly reorders which pairs look like they earn.
 *
 * This gates the LOGGING only. The redirect below always happens —
 * whatever this is, it still gets where it was going.
 */
function cameFromOurSite(req: NextRequest): boolean {
  const referer = req.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).host === req.nextUrl.host;
  } catch {
    return false;
  }
}

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
  if (ua && !isBot(ua) && cameFromOurSite(req)) {
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
