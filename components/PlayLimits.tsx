"use client";

import { useActionState } from "react";
import { setPlayLimits, type ActionResult } from "@/app/actions";

/**
 * Your own limits, set by you.
 *
 * Two controls with deliberately different shapes. A daily cap is a
 * budgeting tool and moves freely in both directions. A break only ever
 * extends — the form can't shorten one, and neither can support, because
 * an exclusion that bends at the moment somebody most wants it to bend is
 * decoration.
 */
export default function PlayLimits({
  dailyStakeLimit,
  excludedUntil,
  stakedToday,
}: {
  dailyStakeLimit: number | null;
  excludedUntil: string | null;
  stakedToday: number;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setPlayLimits, null);
  const onBreak = excludedUntil ? new Date(excludedUntil) > new Date() : false;

  return (
    <form action={action} className="rounded-xl border border-edge bg-surface p-4">
      <p className="tag text-heat">Your limits</p>
      <p className="mt-0.5 text-xs text-smoke">
        Credits are play money, but the habit is real. Set a ceiling, or take a break.
      </p>

      {onBreak && (
        <p className="mt-3 rounded-lg border border-heat/50 bg-heat/10 px-3 py-2 text-sm text-heat">
          You&apos;re on a break until {new Date(excludedUntil!).toDateString()}. Calls are off
          until then. This can be extended, not shortened.
        </p>
      )}

      <div className="mt-3">
        <label className="tag text-smoke" htmlFor="pl-daily">
          Daily stake cap ({stakedToday} staked today)
        </label>
        <input
          id="pl-daily"
          name="dailyStakeLimit"
          inputMode="numeric"
          defaultValue={dailyStakeLimit ?? ""}
          placeholder="No cap"
          className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
      </div>

      <div className="mt-3">
        <label className="tag text-smoke" htmlFor="pl-break">Take a break</label>
        <select
          id="pl-break"
          name="excludeDays"
          defaultValue="0"
          className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white focus:border-volt focus:outline-none"
        >
          <option value="0">No break</option>
          <option value="1">24 hours</option>
          <option value="7">1 week</option>
          <option value="30">30 days</option>
          <option value="180">6 months</option>
        </select>
      </div>

      {state && !state.ok && <p className="mt-2 text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-volt">{state.note}</p>}

      <button
        disabled={pending}
        className="mt-3 rounded-lg border border-edge px-4 py-2 tag font-bold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save limits"}
      </button>
    </form>
  );
}
