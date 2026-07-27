"use client";

import { useActionState } from "react";
import { refreshEverythingNow } from "@/app/actions";
import type { RefreshReport } from "@/lib/refreshAll";

/**
 * The whole database, one click.
 *
 * Deliberately reports every step — including the ones that failed or sat
 * dormant for want of a key. A refresh button that only prints its wins is
 * how you end up believing the data is current when a provider has been
 * down for a week.
 */
export default function FullRefreshButton() {
  const [state, action, pending] = useActionState<RefreshReport | null, FormData>(
    async () => refreshEverythingNow(),
    null
  );

  return (
    <div className="mt-4 rounded-xl border border-heat/40 bg-heat/5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <form action={action}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
          >
            {pending ? "Refreshing everything…" : "↻ Refresh the whole database"}
          </button>
        </form>
        <p className="max-w-md text-xs text-smoke">
          Every brand in the catalog, a deep eBay sweep, release dates, drop drafts,
          orphan repair, price history, call settlement, league rollover and a fresh
          index reading. Takes a few minutes — leave the tab open.
        </p>
      </div>

      {pending && (
        <p className="mt-3 text-xs text-smoke">
          Working through the steps. Nothing is skipped for being slow — this is the
          full pass, not the nightly rotation.
        </p>
      )}

      {state && (
        <div className="mt-3">
          <p className={`tag font-bold ${state.ok ? "text-volt" : "text-heat"}`}>
            {state.ok ? "All steps clean" : `${state.failed} step(s) reported a problem`}
            {" · "}
            {(state.elapsedMs / 1000).toFixed(1)}s
          </p>
          <div className="mt-2 overflow-hidden rounded-lg border border-edge">
            {state.steps.map((s) => (
              <div
                key={s.step}
                className="flex items-start justify-between gap-3 border-b border-edge/60 bg-surface px-3 py-2 last:border-0"
              >
                <span className="font-mono text-xs text-white">{s.step}</span>
                <span className={`text-right text-xs ${s.ok ? "text-smoke" : "text-heat"}`}>
                  {s.ok ? s.detail : `failed — ${s.detail}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
