"use client";

import { useActionState, useState } from "react";
import { createBattle, type ActionResult } from "@/app/actions";
import { categoryEmoji, categoryLabel } from "@/lib/categories";

type Option = { id: string; title: string; artistName: string; category: string };

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white focus:border-volt focus:outline-none";

export default function CreateBattleForm({ options }: { options: Option[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createBattle,
    null
  );
  // Category wall, enforced in the UI too: picking Side A locks Side B
  // to the same lane — hats never even appear against shoes.
  const [sideA, setSideA] = useState("");
  const laneOf = (id: string) => options.find((o) => o.id === id)?.category;
  const lane = sideA ? laneOf(sideA) : null;
  const sideBOptions = lane ? options.filter((o) => o.category === lane) : options;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="subAId" className="tag text-smoke">Side A</label>
          <select
            id="subAId"
            name="subAId"
            required
            className={inputClass}
            value={sideA}
            onChange={(e) => setSideA(e.target.value)}
          >
            <option value="">Pick a custom…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {categoryEmoji(o.category)} {o.title} — {o.artistName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="subBId" className="tag text-smoke">
            Side B{lane ? ` (${categoryLabel(lane)} only — category wall)` : ""}
          </label>
          <select id="subBId" name="subBId" required className={inputClass}>
            <option value="">
              {lane ? `Pick ${categoryLabel(lane)}…` : "Pick a custom…"}
            </option>
            {sideBOptions
              .filter((o) => o.id !== sideA)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {categoryEmoji(o.category)} {o.title} — {o.artistName}
                </option>
              ))}
          </select>
        </div>
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
