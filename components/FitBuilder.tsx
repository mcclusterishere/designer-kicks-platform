"use client";

import { useActionState } from "react";
import { createFanOutfit } from "@/app/actions";
import type { ActionResult } from "@/app/actions";
import { categoryEmoji, categoryLabel } from "@/lib/categories";

type Piece = { id: string; title: string; imageUrl: string; category: string };

const LANES = ["sneakers", "apparel", "accessories"] as const;

/** Fans assemble a full look — one owned piece per category — for the
 *  Fan Fit League. */
export default function FitBuilder({ pieces }: { pieces: Piece[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createFanOutfit,
    null
  );

  if (state?.ok) {
    return (
      <div className="mt-4 rounded-xl border border-volt/50 bg-volt/5 p-5 text-center">
        <p className="display text-xl text-volt">Fit submitted</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-smoke">
          It&apos;s in the Fan Fit League pool — the league office matches
          fits into battles against other fans&apos; looks. Winners get
          bragging rights the whole site can see.
        </p>
      </div>
    );
  }

  const byLane = LANES.map((c) => ({
    category: c,
    pieces: pieces.filter((p) => p.category === c),
  }));

  return (
    <form action={formAction} className="mt-4 space-y-3 rounded-xl border border-edge bg-surface p-5">
      <div>
        <label className="tag text-smoke" htmlFor="fit-name">Name your fit *</label>
        <input
          id="fit-name"
          name="name"
          required
          maxLength={60}
          placeholder='e.g. "Sunday Service Heat"'
          className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
      </div>
      <p className="tag text-smoke">
        A full look is one from each — kicks, apparel, accessory
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {byLane.map((lane) => (
          <fieldset key={lane.category} className="rounded-lg border border-edge bg-panel p-2">
            <legend className="tag px-1 text-volt">
              {categoryEmoji(lane.category)} {categoryLabel(lane.category)}
            </legend>
            <div className="mt-1 space-y-2">
              {lane.pieces.length === 0 && (
                <p className="px-1 py-2 text-xs text-smoke">
                  None owned — cop a{" "}
                  {categoryLabel(lane.category).toLowerCase()} piece first.
                </p>
              )}
              {lane.pieces.map((p) => (
                <label
                  key={p.id}
                  className="group flex cursor-pointer items-center gap-2 overflow-hidden rounded-lg border border-edge bg-surface p-1.5 has-[:checked]:border-volt"
                >
                  <input type="checkbox" name="pieces" value={p.id} className="peer sr-only" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt={p.title} className="h-10 w-10 shrink-0 rounded object-cover opacity-70 peer-checked:opacity-100" />
                  <span className="min-w-0 truncate text-xs text-smoke peer-checked:text-white">
                    {p.title}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="btn-hard w-full rounded-lg py-3 tag font-bold disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Enter The Fan Fit League"}
      </button>
    </form>
  );
}
