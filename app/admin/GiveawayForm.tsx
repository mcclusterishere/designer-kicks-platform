"use client";

import { useActionState } from "react";
import { createGiveaway, type ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function GiveawayForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createGiveaway,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="g-title">Internal title *</label>
          <input id="g-title" name="title" required placeholder="Fall 2026 Giveaway #1" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="g-prize">Prize (public) *</label>
          <input id="g-prize" name="prize" required placeholder='e.g. Air Jordan 4 "Tour Yellow" (size of choice)' className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="tag text-smoke" htmlFor="g-desc">Public description</label>
          <input id="g-desc" name="description" placeholder="Deadstock, receipt included, ships free in the US." className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="g-days">Days</label>
          <input id="g-days" name="days" type="number" min={1} max={90} defaultValue={14} className={`${inputClass} w-24`} />
        </div>
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="text-sm text-volt">Giveaway is live.</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-heat px-5 py-2.5 tag font-bold text-white disabled:opacity-50">
        {pending ? "Creating…" : "Launch Giveaway"}
      </button>
    </form>
  );
}
