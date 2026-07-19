"use client";

import { useActionState } from "react";
import { refreshDropDatesNow, type ActionResult } from "@/app/actions";

export default function DropSyncControls({
  providers,
  withSku,
  total,
}: {
  providers: { kicksdb: boolean; stockx: boolean; apify: boolean };
  withSku: number;
  total: number;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async () => refreshDropDatesNow(),
    null
  );
  const live = providers.kicksdb || providers.stockx || providers.apify;

  const chip = (label: string, on: boolean) => (
    <span
      className={`tag rounded-full border px-2.5 py-1 ${
        on ? "border-volt text-volt" : "border-edge text-smoke/60"
      }`}
    >
      {label} {on ? "· on" : "· off"}
    </span>
  );

  return (
    <div className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="tag text-volt">Drop date auto-sync</p>
          <p className="mt-1 text-sm text-smoke">
            Pulls release dates by style code from the sneaker-API waterfall
            (KicksDB → StockX → Apify). {withSku} of {total} articles have a code.
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending || !live}
            className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-40"
          >
            {pending ? "Syncing…" : "Refresh dates now"}
          </button>
        </form>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {chip("KicksDB", providers.kicksdb)}
        {chip("StockX (RapidAPI)", providers.stockx)}
        {chip("Apify", providers.apify)}
      </div>

      {!live && (
        <p className="mt-3 rounded border border-edge bg-panel px-3 py-2 text-xs text-smoke">
          The sync is dormant — no outbound calls, nothing to break. Turn it on
          by adding any one of <span className="font-mono text-white">KICKSDB_KEY</span>,{" "}
          <span className="font-mono text-white">RAPIDAPI_STOCKX_KEY</span>, or{" "}
          <span className="font-mono text-white">APIFY_TOKEN</span> in Railway, plus{" "}
          <span className="font-mono text-white">CRON_SECRET</span> to guard the
          nightly job (<span className="font-mono text-white">/api/cron/refresh-drops</span>).
          Free tiers are enough to start.
        </p>
      )}

      {state?.error && (
        <p className="mt-3 rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}
      {state?.ok && state.note && (
        <p className="mt-3 rounded border border-volt/40 bg-volt/10 px-3 py-2 text-sm text-volt">
          {state.note}
        </p>
      )}
    </div>
  );
}
