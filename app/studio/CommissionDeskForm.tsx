"use client";

import { useActionState } from "react";
import { setCommissionDesk, type ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

/**
 * Your commission desk. The biggest thing that stops a buyer isn't the
 * price — it's not knowing the price or the wait. Fill this in once and
 * every visitor sees it upfront instead of having to DM you.
 */
export default function CommissionDeskForm({
  current,
}: {
  current: {
    commissionOpen: boolean;
    commissionMinCents: number | null;
    commissionMaxCents: number | null;
    commissionDays: number | null;
    commissionSlots: number | null;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setCommissionDesk,
    null
  );
  const dollars = (c: number | null) => (c ? String(Math.round(c / 100)) : "");

  return (
    <form action={formAction}>
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          name="commissionOpen"
          defaultChecked={current.commissionOpen}
          className="h-4 w-4 accent-[color:var(--volt,#c9f24d)]"
        />
        <span className="text-sm font-bold text-white">I&apos;m taking commissions right now</span>
      </label>
      <p className="mt-1 text-xs text-smoke">
        Uncheck when you&apos;re booked out — your page says &ldquo;booked out&rdquo; instead of
        going quiet on people.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="tag text-smoke" htmlFor="cd-min">Starts at ($)</label>
          <input id="cd-min" name="commissionMinCents" inputMode="numeric" defaultValue={dollars(current.commissionMinCents)} placeholder="180" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="cd-max">Typical top ($)</label>
          <input id="cd-max" name="commissionMaxCents" inputMode="numeric" defaultValue={dollars(current.commissionMaxCents)} placeholder="450" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="cd-days">Turnaround (days)</label>
          <input id="cd-days" name="commissionDays" inputMode="numeric" defaultValue={current.commissionDays ?? ""} placeholder="21" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="cd-slots">Open slots</label>
          <input id="cd-slots" name="commissionSlots" inputMode="numeric" defaultValue={current.commissionSlots ?? ""} placeholder="3" className={inputClass} />
        </div>
      </div>
      <p className="mt-2 text-xs text-smoke">
        Leave any field blank to hide it. Ranges are estimates — nobody holds you to the penny.
      </p>

      {state && !state.ok && <p className="mt-3 text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-sm text-volt">{state.note}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save desk"}
      </button>
    </form>
  );
}
