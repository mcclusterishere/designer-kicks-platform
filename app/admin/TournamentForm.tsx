"use client";

import { useActionState, useState } from "react";
import { createTournamentAction, type ActionResult } from "@/app/actions";

type Option = { id: string; title: string; artistName: string };

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function TournamentForm({ options }: { options: Option[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createTournamentAction,
    null
  );
  const [size, setSize] = useState(4);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="t-name">Tournament name *</label>
          <input id="t-name" name="name" required maxLength={80}
            placeholder='e.g. "Summer Heat Championship"' className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="t-prize">Prize (shown publicly)</label>
          <input id="t-prize" name="prize" maxLength={120}
            placeholder="e.g. $100 + Heat List crown" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="tag text-smoke" htmlFor="t-size">Bracket size</label>
          <select id="t-size" name="size" value={size}
            onChange={(e) => setSize(Number(e.target.value))} className={inputClass}>
            <option value={4}>4 customs</option>
            <option value={8}>8 customs</option>
            <option value={16}>16 customs</option>
          </select>
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="t-days">Days per round</label>
          <input id="t-days" name="roundDays" type="number" min={1} max={14} defaultValue={3} className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="t-division">Division</label>
          <select id="t-division" name="division" defaultValue="OPEN" className={inputClass}>
            <option value="OPEN">Open — all talent</option>
            <option value="RISING">Rising — up-and-comers</option>
            <option value="ELITE">Elite — invitational</option>
          </select>
        </div>
      </div>

      <div>
        <p className="tag text-smoke">
          Entrants — pick exactly {size} ({checked.size} selected). Seeding is
          automatic: Heat Score first, Heat List rank for unrated pieces.
        </p>
        <div className="mt-2 grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-edge bg-surface p-3 sm:grid-cols-2">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-white hover:bg-panel">
              <input
                type="checkbox"
                name="participants"
                value={o.id}
                checked={checked.has(o.id)}
                onChange={() => toggle(o.id)}
                className="h-4 w-4 accent-[#d9b96a]"
              />
              <span className="truncate">
                {o.title} <span className="text-smoke">— {o.artistName}</span>
              </span>
            </label>
          ))}
          {options.length === 0 && (
            <p className="text-sm text-smoke">No approved submissions yet.</p>
          )}
        </div>
      </div>

      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="text-sm text-volt">Bracket is live — round 1 battles are up. 🔥</p>}
      <button
        type="submit"
        disabled={pending || checked.size !== size}
        className="rounded-lg bg-heat px-5 py-2.5 tag font-bold text-white disabled:opacity-50"
      >
        {pending ? "Building bracket…" : "Launch Tournament"}
      </button>
    </form>
  );
}
