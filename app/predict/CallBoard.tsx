"use client";

import Money from "@/components/Money";
import { useState, useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { makePredictionCall } from "@/app/actions";
import { formatUsd } from "@/lib/market";

type Shoe = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  lane: "FRESH" | "MOVER" | "BLUE_CHIP";
  lastCents: number;
  retailCents: number | null;
};

// Why a pair is on the board. Saying it out loud turns a grid of shoes into
// a set of arguments you can disagree with.
const LANE: Record<Shoe["lane"], { label: string; cls: string }> = {
  FRESH: { label: "Fresh", cls: "bg-volt/20 text-volt" },
  MOVER: { label: "Mover", cls: "bg-heat/20 text-heat" },
  BLUE_CHIP: { label: "Blue chip", cls: "bg-white/15 text-white" },
};

/**
 * Make a call: pick a pair, pick a window, say where it lands. Direction is
 * the one-tap version; a price call is the skill ceiling. The line you're
 * calling against is always shown — a prediction without a stated basis
 * isn't a prediction.
 */
export default function CallBoard({ slate }: { slate: Shoe[] }) {
  const router = useRouter();
  const [pick, setPick] = useState<Shoe | null>(null);
  const [kind, setKind] = useState<"DIRECTION" | "PRICE">("DIRECTION");
  const [horizon, setHorizon] = useState(7);
  const [state, action, pending] = useActionState(makePredictionCall, null);

  useEffect(() => {
    if (state?.ok) {
      setPick(null);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {slate.map((s) => (
          <button
            key={s.id}
            onClick={() => setPick(pick?.id === s.id ? null : s)}
            className={`overflow-hidden rounded-xl border text-left transition ${
              pick?.id === s.id ? "border-heat ring-2 ring-heat/40" : "border-edge hover:border-heat/50"
            }`}
          >
            <div className="relative aspect-square bg-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.imageUrl || "/seed/news-1.svg"} alt={s.name} className="h-full w-full object-cover" />
              <span
                className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur ${LANE[s.lane].cls}`}
              >
                {LANE[s.lane].label}
              </span>
            </div>
            <div className="p-2">
              <p className="truncate font-mono text-[10px] font-bold text-white">{s.sku}</p>
              <p className="truncate text-[11px] text-smoke">{s.name}</p>
              <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-heat">
                <Money cents={s.lastCents} showUsd={false} />
              </p>
            </div>
          </button>
        ))}
        {slate.length === 0 && (
          <p className="col-span-full rounded-lg border border-edge bg-surface p-4 text-sm text-smoke">
            No pairs with a live price yet — run the catalog refresh and the board fills up.
          </p>
        )}
      </div>

      {pick && (
        <form
          action={action}
          className="sticky bottom-3 z-10 mt-4 rounded-2xl border border-heat bg-surface/95 p-4 backdrop-blur"
        >
          <input type="hidden" name="shoeId" value={pick.id} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="horizonDays" value={horizon} />

          <p className="text-sm text-white">
            <span className="font-bold">{pick.name}</span>
            <span className="text-smoke"> — calling against </span>
            <span className="font-mono font-bold text-heat"><Money cents={pick.lastCents} /></span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-edge bg-panel p-1">
              {(["DIRECTION", "PRICE"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`rounded-md px-3 py-1.5 tag ${kind === k ? "bg-heat text-ink" : "text-smoke"}`}
                >
                  {k === "DIRECTION" ? "Up / Down" : "Exact price"}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-edge bg-panel p-1">
              {[7, 30].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  className={`rounded-md px-3 py-1.5 tag ${horizon === h ? "bg-heat text-ink" : "text-smoke"}`}
                >
                  {h}d
                </button>
              ))}
            </div>
          </div>

          {kind === "DIRECTION" ? (
            <div className="mt-3 flex gap-2">
              <button
                name="direction"
                value="UP"
                disabled={pending}
                className="flex-1 rounded-lg border border-heat bg-heat/10 py-3 tag font-bold text-heat disabled:opacity-50"
              >
                ▲ Higher in {horizon}d
              </button>
              <button
                name="direction"
                value="DOWN"
                disabled={pending}
                className="flex-1 rounded-lg border border-volt bg-volt/10 py-3 tag font-bold text-volt disabled:opacity-50"
              >
                ▼ Lower in {horizon}d
              </button>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                name="predictedPrice"
                inputMode="decimal"
                placeholder={`e.g. ${Math.round(pick.lastCents / 100)}`}
                className="min-w-0 flex-1 rounded-lg border border-edge bg-surface px-3 py-2.5 text-sm text-white placeholder:text-smoke/50"
              />
              <button disabled={pending} className="rounded-lg btn-hard px-5 tag font-bold disabled:opacity-50">
                {pending ? "Locking…" : "Lock the call"}
              </button>
            </div>
          )}

          {state && !state.ok && <p className="mt-2 text-sm text-volt">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
