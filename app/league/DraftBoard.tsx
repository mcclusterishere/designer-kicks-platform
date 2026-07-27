"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { draftLeagueRoster } from "@/app/actions";

type Custom = { assetType: "CUSTOM"; refId: string; label: string; sub: string; imageUrl: string | null; heat: number };
type Drop = { assetType: "DROP"; refId: string; label: string; sub: string; imageUrl: string | null; premiumPct: number };

const ROSTER = 5;

export default function DraftBoard({ customs, drops }: { customs: Custom[]; drops: Drop[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"customs" | "drops">("customs");
  const [picks, setPicks] = useState<{ assetType: "CUSTOM" | "DROP"; refId: string }[]>([]);
  const [state, formAction, pending] = useActionState(draftLeagueRoster, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const chosen = useMemo(() => new Set(picks.map((p) => p.refId)), [picks]);
  const full = picks.length >= ROSTER;

  function toggle(assetType: "CUSTOM" | "DROP", refId: string) {
    setPicks((prev) => {
      if (prev.some((p) => p.refId === refId)) return prev.filter((p) => p.refId !== refId);
      if (prev.length >= ROSTER) return prev;
      return [...prev, { assetType, refId }];
    });
  }

  const list = tab === "customs" ? customs : drops;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-edge bg-panel p-1">
          <button
            onClick={() => setTab("customs")}
            className={`rounded-md px-4 py-1.5 tag ${tab === "customs" ? "bg-volt text-ink" : "text-smoke"}`}
          >
            Customs
          </button>
          <button
            onClick={() => setTab("drops")}
            className={`rounded-md px-4 py-1.5 tag ${tab === "drops" ? "bg-volt text-ink" : "text-smoke"}`}
          >
            OG Drops
          </button>
        </div>
        <p className="tag text-smoke">
          Drafted <span className={picks.length === ROSTER ? "text-volt" : "text-white"}>{picks.length}</span>/{ROSTER}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((item) => {
          const sel = chosen.has(item.refId);
          const disabled = !sel && full;
          return (
            <button
              key={item.refId}
              type="button"
              onClick={() => toggle(item.assetType, item.refId)}
              disabled={disabled}
              className={`group overflow-hidden rounded-xl border text-left transition ${
                sel ? "border-volt ring-2 ring-volt/40" : "border-edge hover:border-volt/50"
              } ${disabled ? "opacity-40" : ""}`}
            >
              <div className="relative aspect-square bg-panel">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl || "/seed/news-1.svg"} alt={item.label} className="h-full w-full object-cover" />
                {sel && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-volt px-2 py-0.5 tag font-bold text-ink">✓</span>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-bold text-white">{item.label}</p>
                <p className="truncate tag text-smoke">{item.sub}</p>
                <p className="mt-0.5 tag text-volt">
                  {item.assetType === "CUSTOM" ? `${(item as Custom).heat} heat` : `${(item as Drop).premiumPct >= 0 ? "+" : ""}${(item as Drop).premiumPct}% resale`}
                </p>
              </div>
            </button>
          );
        })}
        {list.length === 0 && (
          <p className="col-span-full rounded-lg border border-edge bg-surface p-4 text-sm text-smoke">
            {tab === "customs" ? "No customs on the board yet." : "No drops on the board yet — run the catalog refresh."}
          </p>
        )}
      </div>

      {/* Lock bar */}
      <div className="sticky bottom-3 z-10 mt-5">
        <form action={formAction} className="flex items-center gap-3 rounded-xl border border-edge bg-surface/95 p-3 backdrop-blur">
          <input type="hidden" name="picks" value={JSON.stringify(picks)} />
          <div className="flex-1 text-sm">
            {state && !state.ok ? (
              <span className="text-heat">{state.error}</span>
            ) : (
              <span className="text-smoke">
                Pick {ROSTER} — mix customs and drops. <span className="text-white">{picks.length}/{ROSTER}</span> locked in.
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={picks.length !== ROSTER || pending}
            className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-40"
          >
            {pending ? "Locking…" : "Lock in roster"}
          </button>
        </form>
      </div>
    </div>
  );
}
