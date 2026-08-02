import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cronAuth";
import { refreshPostStats, snapshotPageInsights, liveMetrics, probeMetrics } from "@/lib/pageInsights";
import { prisma } from "@/lib/db";

/**
 * The daily read of the Page.
 *
 * Meta documents that "most metrics will update once every 24 hours"
 * and keeps only two years of history, so a daily snapshot is both the
 * highest useful frequency and the thing that makes the record outlive
 * the API's own retention.
 *
 * Post stats first, deliberately: they need no read_insights and no
 * 100-like Page, so the decision engine keeps working even when Page
 * Insights has nothing to give.
 *
 * Schedule daily, same bearer token as the others:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://theheatchart.com/api/cron/page-insights
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const posts = await refreshPostStats(50).catch((e) => ({
    ok: false as const,
    error: e instanceof Error ? e.message : String(e),
    posts: 0,
    fieldsUsed: null,
  }));

  // Probe only when we have nothing to go on, or once a week — asking
  // Meta fourteen questions every night to hear the same answer is a
  // waste of a rate limit. A deprecation that lands mid-week is caught
  // by the snapshot failing and re-flagging the metric it named.
  const live = await liveMetrics("page");
  const lastProbe = await prisma.metricProbe.findFirst({
    orderBy: { checkedAt: "desc" },
    select: { checkedAt: true },
  });
  const weekOld = !lastProbe || Date.now() - lastProbe.checkedAt.getTime() > 7 * 86_400_000;
  let probe = null;
  if (live.length === 0 || weekOld) {
    const specimen = await prisma.postStat.findFirst({
      orderBy: { publishedAt: "desc" },
      select: { postId: true },
    });
    probe = await probeMetrics(specimen?.postId ?? null).catch(() => null);
  }

  const snapshot = await snapshotPageInsights().catch((e) => ({
    ok: false as const,
    error: e instanceof Error ? e.message : String(e),
    metricsAsked: 0,
    pointsBanked: 0,
    emptyButFine: false,
  }));

  return NextResponse.json({
    posts,
    probe: probe && { alive: probe.alive.length, dead: probe.dead, skipped: probe.skipped },
    snapshot,
  });
}
