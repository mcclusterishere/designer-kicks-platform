"use client";

import { useActionState } from "react";
import { importCatalog, type CatalogImportResult } from "@/app/actions";

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
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
          className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-50">
          {pending ? "Importing…" : "Import shoes"}
        </button>
      </form>
      {state && !state.ok && <p className="mt-2 text-sm text-heat">{state.error}</p>}
      {state?.ok && (
        <p className="mt-2 text-sm text-volt">
          +{state.imported} new, {state.updated} refreshed ({state.seen} scanned).
          {state.note && <span className="text-heat"> {state.note}</span>}{" "}
          Run more queries brand-by-brand to grow the base.
        </p>
      )}
    </div>
  );
}
