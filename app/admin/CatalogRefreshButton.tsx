"use client";

import { useActionState } from "react";
import { refreshCatalogNow, type CatalogRefreshResult } from "@/app/actions";

/**
 * One-click "run the daily catalog refresh now" — pulls a rotating batch
 * of brands from KicksDB (photos + prices) and fresh eBay new/used
 * medians, same as the cron. The eBay line's matched/checked count is a
 * live confirmation the eBay keys work.
 */
export default function CatalogRefreshButton() {
  const [state, action, pending] = useActionState<CatalogRefreshResult | null, FormData>(
    async () => refreshCatalogNow(),
    null
  );

  return (
    <div className="mt-4 border-t border-edge/60 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <form action={action}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-volt px-4 py-2.5 tag font-bold text-volt disabled:opacity-50"
          >
            {pending ? "Refreshing prices + eBay…" : "Refresh prices + eBay now"}
          </button>
        </form>
        <p className="text-xs text-smoke">
          Rotates a batch of brands from KicksDB and pulls live eBay new/used prices —
          same job as the daily cron. Run it a few times to cover every brand.
        </p>
      </div>

      {state && !state.ok && (
        <p className="mt-2 text-sm text-heat">{state.error || "Refresh failed."}</p>
      )}
      {state?.ok && (
        <div className="mt-2 text-sm text-volt">
          <p>
            Brands refreshed:{" "}
            {state.brands && state.brands.length
              ? state.brands.map((b) => `${b.brand} (+${b.imported}/${b.updated})`).join(", ")
              : "—"}
          </p>
          <p className="mt-0.5">
            eBay:{" "}
            {state.ebay?.configured
              ? `${state.ebay.matched}/${state.ebay.checked} pairs matched live prices`
              : "not configured (add eBay keys)"}
          </p>
        </div>
      )}
    </div>
  );
}
