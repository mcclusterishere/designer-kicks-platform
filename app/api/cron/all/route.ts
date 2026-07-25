import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cronAuth";

/**
 * Everything, one call. Instead of wiring five separate schedules, point a
 * single daily job here and the whole site keeps itself current:
 *
 *   https://theheatchart.com/api/cron/all?key=CRON_SECRET
 *
 * Each step is independent and failure-isolated — a dead provider or a
 * missing key degrades that one step to a note in the response instead of
 * taking the run down. Steps with no credentials configured report
 * "dormant" and cost nothing, so this is safe to schedule before every
 * integration is switched on.
 *
 * Battle finalisation is time-sensitive (it closes votes on schedule), so
 * keep the dedicated /finalize job on its own short interval and let this
 * one carry the daily work.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Step = { step: string; ok: boolean; detail: string };

async function run(step: string, fn: () => Promise<unknown>): Promise<Step> {
  try {
    const out = await fn();
    return { step, ok: true, detail: summarize(out) };
  } catch (e) {
    return { step, ok: false, detail: e instanceof Error ? e.message : "failed" };
  }
}

function summarize(out: unknown): string {
  if (out == null) return "done";
  if (typeof out === "string") return out;
  if (typeof out === "object") {
    const o = out as Record<string, unknown>;
    // Pull the handful of counters these jobs actually return.
    const bits = ["imported", "updated", "checked", "matched", "drafted", "skipped", "finalized", "sent", "scanned"]
      .filter((k) => typeof o[k] === "number")
      .map((k) => `${k}: ${o[k]}`);
    if (bits.length) return bits.join(", ");
    if (typeof o.configured === "boolean" && !o.configured) return "dormant (no key)";
    if (typeof o.ok === "boolean") return o.ok ? "done" : String(o.detail ?? "skipped");
    if (Array.isArray(o.brands)) return `${(o.brands as unknown[]).length} brand(s) refreshed`;
  }
  return "done";
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const steps: Step[] = [];

  // 1. Close out any battles whose clock ran out.
  steps.push(
    await run("finalize-battles", async () => {
      const { finalizeExpiredBattles } = await import("@/lib/battles");
      const { prisma } = await import("@/lib/db");
      const before = await prisma.battle.count({ where: { status: "ACTIVE" } });
      await finalizeExpiredBattles(true);
      const after = await prisma.battle.count({ where: { status: "ACTIVE" } });
      return { finalized: before - after };
    })
  );

  // 2. Catalog prices + photos from the provider (dormant without KICKSDB_KEY).
  steps.push(
    await run("refresh-catalog", async () => {
      const { refreshCatalogPricing } = await import("@/lib/catalog");
      return refreshCatalogPricing();
    })
  );

  // 3. eBay new/used medians (dormant without eBay keys).
  steps.push(
    await run("ebay-prices", async () => {
      const { syncEbayPrices } = await import("@/lib/ebay");
      return syncEbayPrices();
    })
  );

  // 4. Release dates by style code across the provider waterfall.
  steps.push(
    await run("refresh-drops", async () => {
      const { refreshDropDates } = await import("@/lib/dropRefresh");
      return refreshDropDates();
    })
  );

  // 5. Draft drop posts for editor review — never publishes on its own.
  steps.push(
    await run("drop-radar", async () => {
      const { generateDropDrafts } = await import("@/lib/dropRadar");
      return generateDropDrafts(3);
    })
  );

  // 6. Sweep today's market prices into per-pair history. Retroactive
  // sneaker pricing can't be bought for free, so the charts are built by
  // never missing a day from here on.
  steps.push(
    await run("price-history", async () => {
      const { snapshotMarketPrices } = await import("@/lib/priceHistory");
      return snapshotMarketPrices(500);
    })
  );

  // 7. Settle prediction calls whose window has closed.
  steps.push(
    await run("settle-calls", async () => {
      const { resolveDuePredictions } = await import("@/lib/predictions");
      return resolveDuePredictions();
    })
  );

  // 8. Fingerprint the market so the index has real history to chart.
  steps.push(
    await run("index-snapshot", async () => {
      const { recordIndexSnapshot } = await import("@/lib/exchange");
      return recordIndexSnapshot();
    })
  );

  const failed = steps.filter((s) => !s.ok).length;
  return NextResponse.json({
    ok: failed === 0,
    ranAt: new Date().toISOString(),
    failed,
    steps,
  });
}
