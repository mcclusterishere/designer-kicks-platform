"use client";

import { useActionState } from "react";
import { announceArtistDrop } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function AnnounceDropForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    announceArtistDrop,
    null
  );

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-volt bg-surface p-6 text-center glow-volt">
        <p className="display text-2xl text-volt">Drop submitted</p>
        <p className="mt-2 text-sm text-smoke">
          It goes to the league office for a quick review — once approved it
          lands on the public drop calendar. Refresh to announce another.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="d-title" className="tag text-smoke">Drop name *</label>
          <input id="d-title" name="title" required maxLength={120}
            placeholder="e.g. 'Sunset Blvd' AF1 — limited run" className={inputClass} />
        </div>
        <div>
          <label htmlFor="d-date" className="tag text-smoke">Release date *</label>
          <input id="d-date" name="dropAt" type="date" required className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="d-desc" className="tag text-smoke">The story (optional)</label>
        <textarea id="d-desc" name="description" rows={3} maxLength={600}
          placeholder="What's dropping, how many pairs, how to cop…" className={inputClass} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="d-buy" className="tag text-smoke">Where to buy / RSVP link (optional)</label>
          <input id="d-buy" name="buyUrl" maxLength={300}
            placeholder="https://…" className={inputClass} />
        </div>
        <div>
          <label htmlFor="d-img" className="tag text-smoke">Image URL (optional)</label>
          <input id="d-img" name="imageUrl" maxLength={400}
            placeholder="https://… a preview shot" className={inputClass} />
        </div>
      </div>
      {state?.error && (
        <p className="rounded border border-heat/40 bg-heat/10 px-4 py-2 text-sm text-heat">{state.error}</p>
      )}
      <button type="submit" disabled={pending}
        className="w-full rounded-lg bg-heat py-3 tag font-bold text-white glow-heat disabled:opacity-50">
        {pending ? "Submitting…" : "Announce This Drop"}
      </button>
      <p className="text-xs text-smoke">
        Announced drops are reviewed before they hit the public calendar —
        keeps the calendar trustworthy.
      </p>
    </form>
  );
}
