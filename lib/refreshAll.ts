/**
 * One pipeline, two triggers.
 *
 * The nightly cron and the admin's "refresh everything" button used to be
 * different code, which is how you end up with a button that quietly does
 * less than the job it appears to run. They now call this, so whatever the
 * schedule does at 4am is exactly what the button does at noon.
 *
 * Two shapes of run:
 *   - "nightly"  — the polite one. Rotates a few catalog brands per night so
 *                  the provider is never hammered, and over a week or two the
 *                  whole base cycles through.
 *   - "deep"     — the button. Sweeps every brand, re-reads every price, and
 *                  rebuilds the derived tables in one pass.
 *
 * Every step is isolated: a dead provider or a missing key degrades that one
 * step to a line in the report instead of taking the run down. Steps with no
 * credentials say "dormant" and cost nothing, so this is safe to run before
 * every integration is switched on.
 */

export type Step = { step: string; ok: boolean; detail: string };
export type RefreshMode = "nightly" | "deep";

export type RefreshReport = {
  ok: boolean;
  mode: RefreshMode;
  ranAt: string;
  elapsedMs: number;
  failed: number;
  steps: Step[];
};

async function run(step: string, fn: () => Promise<unknown>): Promise<Step> {
  try {
    return { step, ok: true, detail: summarize(await fn()) };
  } catch (e) {
    return { step, ok: false, detail: e instanceof Error ? e.message : "failed" };
  }
}

function summarize(out: unknown): string {
  if (out == null) return "done";
  if (typeof out === "string") return out;
  if (typeof out === "object") {
    const o = out as Record<string, unknown>;
    const bits = [
      "imported", "updated", "checked", "matched", "drafted", "skipped",
      "finalized", "sent", "scanned", "shoes", "points", "settled", "voided",
      "recorded", "covered", "repaired", "seasons",
    ]
      .filter((k) => typeof o[k] === "number")
      .map((k) => `${k}: ${o[k]}`);

    // A partial sweep must never read as a complete one.
    if (typeof o.covered === "number" && typeof o.ofBrands === "number") {
      bits.push(`of ${o.ofBrands} brands`);
      if (o.stoppedEarly) bits.push(`stopped early — ${String(o.stoppedEarly)}`);
    }
    if (bits.length) return bits.join(", ");
    if (typeof o.configured === "boolean" && !o.configured) return "dormant (no key)";
    if (typeof o.ok === "boolean") return o.ok ? "done" : String(o.detail ?? o.error ?? "skipped");
    if (Array.isArray(o.brands)) {
      const bs = o.brands as { imported?: number; updated?: number }[];
      const imported = bs.reduce((s, b) => s + (b.imported ?? 0), 0);
      const updated = bs.reduce((s, b) => s + (b.updated ?? 0), 0);
      return `${bs.length} brand(s): imported ${imported}, updated ${updated}`;
    }
  }
  return "done";
}

export async function refreshEverything(mode: RefreshMode = "nightly"): Promise<RefreshReport> {
  const started = Date.now();
  const deep = mode === "deep";
  const steps: Step[] = [];

  // 1. Close out any battles whose clock ran out. Time-sensitive, so it
  //    leads — everything downstream reads the standings it settles.
  steps.push(
    await run("finalize-battles", async () => {
      const { finalizeExpiredBattles } = await import("./battles");
      const { prisma } = await import("./db");
      const before = await prisma.battle.count({ where: { status: "ACTIVE" } });
      await finalizeExpiredBattles(true);
      const after = await prisma.battle.count({ where: { status: "ACTIVE" } });
      return { finalized: before - after };
    })
  );

  // 2. Catalog: every brand on a deep run, the day's rotation on a nightly.
  steps.push(
    await run(deep ? "catalog-full-sweep" : "refresh-catalog", async () => {
      const { sweepAllBrands, refreshCatalogPricing } = await import("./catalog");
      return deep ? sweepAllBrands() : refreshCatalogPricing();
    })
  );

  // 3. eBay new/used medians. A deep run reaches much further down the book.
  steps.push(
    await run("ebay-prices", async () => {
      const { syncEbayPrices } = await import("./ebay");
      return syncEbayPrices(deep ? 300 : undefined);
    })
  );

  // 4. Release dates by style code across the provider waterfall.
  steps.push(
    await run("refresh-drops", async () => {
      const { refreshDropDates } = await import("./dropRefresh");
      return refreshDropDates();
    })
  );

  // 5. Draft drop posts for editor review — never publishes on its own.
  steps.push(
    await run("drop-radar", async () => {
      const { generateDropDrafts } = await import("./dropRadar");
      return generateDropDrafts(deep ? 6 : 3);
    })
  );

  // 6. Re-point any piece that lost its artist link, so the Heat List and
  //    the closets stay whole. Cheap, and it repairs rather than hides.
  steps.push(
    await run("relink-orphans", async () => {
      const { relinkOrphanPieces } = await import("./maintenance");
      return relinkOrphanPieces();
    })
  );

  // 7. Sweep today's market prices into per-pair history. Retroactive
  //    sneaker pricing can't be bought for free, so the charts get built by
  //    never missing a day from here on.
  steps.push(
    await run("price-history", async () => {
      const { snapshotMarketPrices } = await import("./priceHistory");
      return snapshotMarketPrices(deep ? 5000 : 500);
    })
  );

  // 8. Settle prediction calls whose window has closed.
  steps.push(
    await run("settle-calls", async () => {
      const { resolveDuePredictions } = await import("./predictions");
      return resolveDuePredictions();
    })
  );

  // 9. Settle any league season that has ended and open the next board.
  steps.push(
    await run("league-season", async () => {
      const { getCurrentSeason } = await import("./league");
      const s = await getCurrentSeason();
      return { seasons: 1, detail: s?.id ? "current season open" : "none" };
    })
  );

  // 10. Tell people the things they'd be annoyed to have missed. Runs after
  //     the drop and battle work above so it announces current state, and
  //     stays dormant without VAPID keys.
  steps.push(
    await run("notify-closing-battles", async () => {
      const { notifyClosingBattles, pushConfigured } = await import("./push");
      if (!pushConfigured()) return { configured: false };
      return notifyClosingBattles();
    })
  );
  steps.push(
    await run("notify-upcoming-drops", async () => {
      const { notifyUpcomingDrops, pushConfigured } = await import("./push");
      if (!pushConfigured()) return { configured: false };
      return notifyUpcomingDrops();
    })
  );

  // 11. Release whatever the drip feed says is due. Paced per destination,
  //     so this sends at most one post per place per run no matter how
  //     often it runs.
  steps.push(
    await run("drip-feed", async () => {
      const { drainQueue } = await import("./dripFeed");
      return drainQueue();
    })
  );

  // 12. Fingerprint the market so the index has real history to chart.
  //     Last, so it measures the state everything above just produced.
  steps.push(
    await run("index-snapshot", async () => {
      const { recordIndexSnapshot } = await import("./exchange");
      return recordIndexSnapshot();
    })
  );

  const failed = steps.filter((s) => !s.ok).length;
  return {
    ok: failed === 0,
    mode,
    ranAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    failed,
    steps,
  };
}
