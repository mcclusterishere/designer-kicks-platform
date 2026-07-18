import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { allowAttempt } from "@/lib/ratelimit";
import { classifyHit, deviceFrom, isBot, visitorHash } from "@/lib/traffic";

export const dynamic = "force-dynamic";

// First-party pageview beacon. Fired by TrackPageview on every route
// change (sendBeacon). Bots, admin pages, DNT, and opted-out browsers
// never reach this endpoint or are dropped here; raw IPs are hashed
// immediately and never stored.
export async function POST(req: NextRequest) {
  const ok = NextResponse.json({ ok: true }); // beacons ignore the body — always 200
  try {
    const ua = req.headers.get("user-agent") ?? "";
    if (!ua || isBot(ua)) return ok;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    // Generous: one IP can be a whole carrier NAT on a viral post.
    if (!allowAttempt("pageview", ip, 600, 60 * 1000)) return ok;

    const body = (await req.json().catch(() => null)) as {
      path?: string;
      search?: string;
      referrer?: string;
    } | null;
    const path = String(body?.path ?? "");
    if (!path.startsWith("/") || path.length > 200 || path.startsWith("/admin")) return ok;
    const search = String(body?.search ?? "").slice(0, 500);
    const referrer = String(body?.referrer ?? "").slice(0, 500);

    const selfHost = new URL(
      process.env.NEXT_PUBLIC_SITE_URL || `http://${req.headers.get("host") || "localhost"}`
    ).hostname.toLowerCase();
    const hit = classifyHit(search, referrer, selfHost);

    await prisma.pageView.create({
      data: {
        path,
        source: hit.source,
        medium: hit.medium,
        campaign: hit.campaign,
        referrerHost: hit.referrerHost,
        device: deviceFrom(ua),
        visitorHash: visitorHash(ip, ua),
      },
    });

    // Data minimization: opportunistically drop rows older than 180 days.
    if (Math.random() < 0.01) {
      prisma.pageView
        .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } } })
        .catch(() => {});
    }
  } catch {
    // Analytics must never break the site — swallow everything.
  }
  return ok;
}
