"use client";

import { useActionState } from "react";
import { importCatalog, type CatalogImportResult } from "@/app/actions";
import { HEAT_MULTIPLE } from "@/lib/rarity";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

/** Bulk-import runner: one query + page count per run, upserts by SKU. */
export default function CatalogPanel({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState<CatalogImportResult | null, FormData>(
    importCatalog,
    null
  );
  return (
    <div>
      {!configured && (
        <p className="mb-3 rounded-lg border border-heat/40 bg-heat/10 p-3 text-sm text-heat">
          Dormant — add <span className="font-mono">KICKSDB_KEY</span> (kicks.dev) in Railway and
          this imports for real. Same key the drop-date sync uses.
        </p>
      )}
      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="tag text-smoke" htmlFor="cat-q">Import by query (brand or model)</label>
          <input id="cat-q" name="query" maxLength={80} placeholder='"Jordan", "Air Force 1", "Dunk"…' className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="cat-p">Pages (×50 shoes)</label>
          <select id="cat-p" name="pages" defaultValue="2" className={inputClass}>
            {[1, 2, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button type="submit" disabled={pending}
          className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50">
          {pending ? "Importing…" : "Import shoes"}
        </button>
        </div>
        {/* The filter is on unless somebody deliberately turns it off. A
            general release trading at or under its sticker is the opposite
            of what this site is about, and importing thousands of them is
            what made the base look like everybody else's. Pairs already in
            the catalog always refresh — this only decides what gets in. */}
        <label className="flex items-start gap-2 text-xs text-smoke">
          <input id="cat-common" type="checkbox" name="includeCommon" className="mt-0.5 accent-heat" />
          <span>
            Include commoners — import general releases trading at or under retail too.
            Off by default: only pairs at {HEAT_MULTIPLE}× retail or better, plus anything
            not priced yet, get a seat.
          </span>
        </label>
      </form>
      {state && !state.ok && <p className="mt-2 text-sm text-heat">{state.error}</p>}
      {state?.ok && (
        <p className="mt-2 text-sm text-volt">
          +{state.imported} new, {state.updated} refreshed ({state.seen} scanned
          {typeof state.priced === "number" && `, ${state.priced} with live pricing`}
          {typeof state.retailPriced === "number" && `, ${state.retailPriced} with retail`}).
          {typeof state.skipped === "number" && state.skipped > 0 && (
            <span className="text-smoke">
              {" "}
              {state.skipped} commoner{state.skipped === 1 ? "" : "s"} turned away — priced at or
              under retail.
            </span>
          )}
          {state.note && <span className="text-heat"> {state.note}</span>}{" "}
          Run more queries brand-by-brand to grow the base.
        </p>
      )}
      {state?.ok && state.imported === 0 && (state.skipped ?? 0) > 0 && (
        <p className="mt-1 text-xs text-smoke">
          Every new pair that query found was a general release. That is the filter
          working, not a failure — tick “include commoners” if you want them anyway.
        </p>
      )}
      {state?.ok && state.priced === 0 && (state.seen ?? 0) > 0 && (
        <p className="mt-1 text-xs text-heat">
          0 live prices came back — the provider may not include market data on
          this plan/endpoint.
        </p>
      )}
      {state?.ok && state.retailPriced === 0 && (state.seen ?? 0) > 0 && (
        <p className="mt-1 text-xs text-heat">
          0 retail prices came back — the provider&apos;s list payload is arriving
          without retail even with the display hints. If this persists, retail
          needs the per-product detail endpoint on this plan.
        </p>
      )}

      {/* Research exports — feed the base to NotebookLM/Gemini, bring back
          article angles. One CSV per brand, or the whole knowledge base. */}
      <div className="mt-4 border-t border-edge pt-3">
        <p className="tag text-smoke">Export the knowledge base (CSV)</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <a href="/api/catalog-export" className="tag rounded-full border border-edge px-3 py-1.5 text-smoke transition hover:border-volt hover:text-white">
            Everything
          </a>
          {["Jordan", "Nike", "adidas", "New Balance"].map((b) => (
            <a
              key={b}
              href={`/api/catalog-export?brand=${encodeURIComponent(b)}`}
              className="tag rounded-full border border-edge px-3 py-1.5 text-smoke transition hover:border-volt hover:text-white"
            >
              {b}
            </a>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-smoke/70">
          Any brand works: <span className="font-mono">/api/catalog-export?brand=Asics</span> —
          or <span className="font-mono">?q=dunk</span> for a search slice.
        </p>
      </div>
    </div>
  );
}
