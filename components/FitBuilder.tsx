"use client";

import { useActionState } from "react";
import { createFanOutfit } from "@/app/actions";
import type { ActionResult } from "@/app/actions";
import { categoryEmoji } from "@/lib/categories";

type Piece = { id: string; title: string; imageUrl: string; category: string };

/** Fans assemble 2–5 owned pieces into a fit for the fan league. */
export default function FitBuilder({ pieces }: { pieces: Piece[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createFanOutfit,
    null
  );

  if (state?.ok) {
    return (
      <div className="mt-4 rounded-xl border border-volt/50 bg-volt/5 p-5 text-center">
        <p className="display text-xl text-volt">Fit submitted 🔥</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-smoke">
          It&apos;s in the fit-battle pool — the league office matches fits
          into battles, and fan fits can face the house head-on. Winners
          get bragging rights the whole site can see.
        </p>
      </div>
    );
  }

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
      <p className="tag text-smoke">Pick 2–5 pieces from your closet</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pieces.map((p) => (
          <label
            key={p.id}
            className="group cursor-pointer overflow-hidden rounded-lg border border-edge bg-panel has-[:checked]:border-volt"
          >
            <input type="checkbox" name="pieces" value={p.id} className="peer sr-only" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imageUrl} alt={p.title} className="aspect-square w-full object-cover opacity-70 peer-checked:opacity-100" />
            <p className="truncate px-2 py-1.5 text-xs text-smoke">
              {categoryEmoji(p.category)} {p.title}
            </p>
          </label>
        ))}
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="btn-hard w-full rounded-lg py-3 tag font-bold disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Enter The Fit Battles"}
      </button>
    </form>
  );
}
