"use client";

import { useActionState } from "react";
import { createBattle, type ActionResult } from "@/app/actions";

type Option = { id: string; title: string; artistName: string };

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white focus:border-volt focus:outline-none";

export default function CreateBattleForm({ options }: { options: Option[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createBattle,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(["subAId", "subBId"] as const).map((name, i) => (
          <div key={name}>
            <label htmlFor={name} className="tag text-smoke">
              {i === 0 ? "Side A" : "Side B"}
            </label>
            <select id={name} name={name} required className={inputClass}>
              <option value="">Pick a custom…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} — {o.artistName}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="battle-title" className="tag text-smoke">
            Battle title (optional)
          </label>
          <input
            id="battle-title"
            name="title"
            maxLength={80}
            placeholder='e.g. "AF1 Championship — Round 1"'
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="days" className="tag text-smoke">
            Length (days)
          </label>
          <input
            id="days"
            name="days"
            type="number"
            min={1}
            max={30}
            defaultValue={7}
            className={inputClass}
          />
        </div>
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="text-sm text-volt">Battle is live. 🔥</p>}
      <button
        type="submit"
        disabled={pending || options.length < 2}
        className="rounded-lg bg-heat px-5 py-2.5 tag font-bold text-white disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start Battle"}
      </button>
      {options.length < 2 && (
        <p className="text-xs text-smoke">
          You need at least two approved submissions to start a battle.
        </p>
      )}
    </form>
  );
}
