"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { makePredictionCall } from "@/app/actions";
import Money from "@/components/Money";
import Explain from "@/components/Explain";

const STAKES = [0, 5, 10, 25, 50];

/**
 * The ticket: stake, direction, window, one button.
 *
 * Modelled on a trading ticket rather than a poll, because that's what it
 * is — the number you're calling against is printed on it, the stake is a
 * commitment, and the payout is stated before you commit rather than
 * discovered afterwards.
 *
 * Stakes are Culture credits. They're earned by playing and spent on
 * entries; they are never money and never pay out as money, which is what
 * keeps this a game rather than a regulated product. The copy says so where
 * somebody is about to risk them.
 */
export default function CallTicket({
  side,
  targetId,
  basisCents,
  credits,
  crowd,
  signedIn,
}: {
  side: "OG" | "CUSTOM";
  targetId: string;
  basisCents: number | null;
  credits: number;
  crowd: { up: number; down: number };
  signedIn: boolean;
}) {
  const [state, action, pending] = useActionState(makePredictionCall, null);
  const [stake, setStake] = useState(10);
  const [horizon, setHorizon] = useState(7);
  const [kind, setKind] = useState<"DIRECTION" | "PRICE">("DIRECTION");
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  if (!signedIn) {
    return (
      <div className="rounded-xl border border-edge bg-panel p-4 text-sm">
        <a href="/signin" className="font-bold text-volt underline">Sign in</a>{" "}
        <span className="text-smoke">to call this one and put credits behind it.</span>
      </div>
    );
  }

  if (!basisCents) {
    return (
      <div className="rounded-xl border border-edge bg-panel p-4 text-sm text-smoke">
        No price on this one yet — nothing to call against.
      </div>
    );
  }

  const total = crowd.up + crowd.down;
  const upPct = total === 0 ? 50 : Math.round((crowd.up / total) * 100);
  // The minority bonus is the whole strategy, so it's shown, not hidden.
  const upMinority = total > 0 && crowd.up < crowd.down;
  const downMinority = total > 0 && crowd.down < crowd.up;
  const affordable = stake === 0 || credits >= stake;

  return (
    <form action={action} className="rounded-xl border border-heat/50 bg-panel p-4">
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name={side === "OG" ? "shoeId" : "submissionId"} value={targetId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="horizonDays" value={horizon} />
      <input type="hidden" name="stakeCredits" value={stake} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="tag text-heat">Your call</p>
        <p className="tag text-smoke">
          balance <span className="font-bold text-white">{credits}</span> credits
        </p>
      </div>

      <p className="mt-1 text-sm text-smoke">
        Calling against <Money cents={basisCents} className="font-bold text-white" showUsd={false} />
      </p>

      {/* Where the room is. Being on the small side pays more. */}
      {total > 0 && (
        <div className="mt-3">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-surface">
            <span className="h-full bg-heat" style={{ width: `${upPct}%` }} />
            <span className="h-full flex-1 bg-volt/70" />
          </div>
          <p className="tag mt-1 text-smoke">
            {upPct}% of {total} open call{total === 1 ? "" : "s"} say higher
            {/* Why the small side pays more is a real markets idea — a view
                everyone already holds is already in the price. Worth naming
                at the exact moment someone is deciding whether to fade the
                room. */}
            <Explain lesson="crowd" values={{ crowdUp: crowd.up, crowdDown: crowd.down }} />
          </p>
        </div>
      )}

      {/* Stake */}
      <div className="mt-3">
        <p className="tag text-smoke">Stake</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {STAKES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStake(s)}
              disabled={s > credits}
              className={`rounded-lg border px-3 py-1.5 tag font-bold transition disabled:opacity-30 ${
                stake === s ? "border-heat bg-heat/15 text-heat" : "border-edge text-smoke hover:text-white"
              }`}
            >
              {s === 0 ? "Free" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Kind + window */}
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="inline-flex rounded-lg border border-edge bg-surface p-1">
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
        <div className="inline-flex rounded-lg border border-edge bg-surface p-1">
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
            disabled={pending || !affordable}
            className="flex-1 rounded-lg border border-heat bg-heat/10 py-3 tag font-bold text-heat disabled:opacity-40"
          >
            ▲ Higher
            {stake > 0 && (
              <span className="block text-[10px] font-normal opacity-80">
                wins {stake * (upMinority ? 3 : 2)}
                {upMinority ? " · against the room" : ""}
              </span>
            )}
          </button>
          <button
            name="direction"
            value="DOWN"
            disabled={pending || !affordable}
            className="flex-1 rounded-lg border border-volt bg-volt/10 py-3 tag font-bold text-volt disabled:opacity-40"
          >
            ▼ Lower
            {stake > 0 && (
              <span className="block text-[10px] font-normal opacity-80">
                wins {stake * (downMinority ? 3 : 2)}
                {downMinority ? " · against the room" : ""}
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            name="predictedPrice"
            inputMode="decimal"
            placeholder={`e.g. ${Math.round(basisCents / 100)}`}
            className="min-w-0 flex-1 rounded-lg border border-edge bg-surface px-3 py-2.5 text-sm text-white placeholder:text-smoke/50"
          />
          <button
            disabled={pending || !affordable}
            className="rounded-lg btn-hard px-5 tag font-bold disabled:opacity-40"
          >
            {pending ? "Locking…" : "Lock it"}
          </button>
        </div>
      )}

      {state && !state.ok && <p className="mt-2 text-sm text-volt">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-heat">{state.note ?? "Called."}</p>}

      <p className="tag mt-3 leading-relaxed text-smoke">
        Credits are the site&apos;s play money — earned by playing, spent on entries.
        They are never cash and never pay out as cash. A wrong call costs you the
        stake and nothing else.
      </p>
    </form>
  );
}
