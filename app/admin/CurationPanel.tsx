"use client";

import { useActionState } from "react";
import { curateCatalogAction, type CurationActionResult } from "@/app/actions";

type Sample = { sku: string; name: string; why: string };

/**
 * The chopping block, shown before anything moves.
 *
 * "Delete the commoners" is a one-way decision on a catalogue nobody has
 * counted, so this leads with the counts and a sample of what would
 * actually go. The apply button needs a typed confirmation and the undo
 * sits next to it, because the honest way to offer an irreversible-
 * feeling action is to make it reversible and say so.
 */
export default function CurationPanel({
  preview,
}: {
  preview: {
    total: number; collab: number; rare: number; common: number; unknown: number;
    alreadyHidden: number; wouldHide: number;
    sampleCommon: Sample[]; sampleUnpricedCollab: Sample[];
    collateral: { ratings: number; priceSnapshots: number; predictions: number; battles: number };
  };
}) {
  const [state, action, pending] = useActionState<CurationActionResult | null, FormData>(
    curateCatalogAction,
    null
  );
  const p = preview;
  const kept = p.collab + p.rare;

  return (
    <section className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl text-white">Collabs and rare only</h2>
        <p className="tag text-smoke">{p.total.toLocaleString()} pairs in the base</p>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-smoke">
        The editorial line, applied to a catalogue that was imported before there was one.
        Nothing here deletes: a hidden pair leaves the grid, the search, the sitemap and the
        API, and comes straight back if you change your mind.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {[
          { n: p.collab, label: "Collabs", note: "kept — named collaborator", tone: "text-volt" },
          { n: p.rare, label: "Rare", note: "kept — 2×+ over retail", tone: "text-volt" },
          { n: p.unknown, label: "Not priced yet", note: "left alone", tone: "text-smoke" },
          { n: p.common, label: "Commoners", note: "at or under retail", tone: "text-heat" },
        ].map((b) => (
          <div key={b.label} className="rounded-lg border border-edge bg-panel px-3 py-2">
            <p className={`display text-2xl ${b.tone}`}>{b.n.toLocaleString()}</p>
            <p className="text-sm text-white">{b.label}</p>
            <p className="text-xs text-smoke">{b.note}</p>
          </div>
        ))}
      </div>

      {p.unknown > kept && (
        <p className="mt-3 rounded-lg border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
          Most of the base has no live price yet, so it cannot be judged either way — and
          nothing unpriced gets hidden. Run the catalogue and eBay price syncs first and this
          split will be worth acting on; right now it mostly says &ldquo;we haven&rsquo;t looked&rdquo;.
        </p>
      )}

      {p.sampleCommon.length > 0 && (
        <div className="mt-4">
          <p className="tag text-smoke">What would go — a sample</p>
          <div className="mt-2 space-y-1">
            {p.sampleCommon.map((s) => (
              <div key={s.sku} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-edge bg-panel px-3 py-1.5">
                <span className="min-w-0 text-sm text-white">{s.name}</span>
                <span className="tag shrink-0 text-smoke">{s.why}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {p.sampleUnpricedCollab.length > 0 && (
        <div className="mt-4">
          <p className="tag text-smoke">
            Collabs with no price yet — kept because of the name, not the number
          </p>
          <div className="mt-2 space-y-1">
            {p.sampleUnpricedCollab.map((s) => (
              <div key={s.sku} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-volt/30 bg-volt/5 px-3 py-1.5">
                <span className="min-w-0 text-sm text-white">{s.name}</span>
                <span className="tag shrink-0 text-volt">{s.why}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What a HARD delete would take with it — the reason this hides. */}
      {(p.collateral.ratings > 0 ||
        p.collateral.priceSnapshots > 0 ||
        p.collateral.predictions > 0 ||
        p.collateral.battles > 0) && (
        <p className="mt-4 rounded-lg border border-edge bg-panel px-3 py-2 text-xs text-smoke">
          For reference, deleting those rows outright — rather than hiding them — would also
          destroy {p.collateral.ratings.toLocaleString()} flame rating(s),{" "}
          {p.collateral.priceSnapshots.toLocaleString()} price-history point(s) and{" "}
          {p.collateral.predictions.toLocaleString()} member prediction(s), and leave{" "}
          {p.collateral.battles.toLocaleString()} battle(s) pointing at nothing. That is why
          this hides instead.
        </p>
      )}

      <form action={action} className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="tag text-smoke" htmlFor="cur-confirm">
            Type HIDE to confirm
          </label>
          <input
            id="cur-confirm"
            name="confirm"
            placeholder="HIDE"
            autoComplete="off"
            className="mt-1 w-32 rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-heat focus:outline-none"
          />
        </div>
        <button
          name="op"
          value="hide"
          disabled={pending || p.wouldHide === 0}
          className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
        >
          {pending ? "Working…" : `Take ${p.wouldHide.toLocaleString()} off the site`}
        </button>
        {p.alreadyHidden > 0 && (
          <button
            name="op"
            value="undo"
            disabled={pending}
            className="rounded-lg border border-edge px-4 py-2.5 tag text-smoke transition hover:text-white disabled:opacity-50"
          >
            Put back {p.alreadyHidden.toLocaleString()}
          </button>
        )}
      </form>
      {state && !state.ok && <p className="mt-2 text-sm text-heat">{state.error}</p>}
      {state?.ok && state.note && <p className="mt-2 text-sm text-volt">{state.note}</p>}
    </section>
  );
}
