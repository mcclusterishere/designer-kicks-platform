"use client";

import { useActionState } from "react";
import { applyAppraiser } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

const field =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function AppraiserApplyForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    applyAppraiser,
    null
  );

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-volt bg-surface p-6 text-center">
        <p className="display text-2xl text-volt">Application in ✓</p>
        <p className="mt-2 text-sm text-smoke">
          The administration reviews every appraiser personally — expect an
          email to set up a conversation and a look at a sample Portfolio
          Statement.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ap-name" className="tag text-smoke">Name *</label>
          <input id="ap-name" name="name" required maxLength={80} className={field} />
        </div>
        <div>
          <label htmlFor="ap-email" className="tag text-smoke">Email *</label>
          <input id="ap-email" name="email" type="email" required className={field} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ap-org" className="tag text-smoke">
            Credentials <span className="normal-case">(org + designation)</span>
          </label>
          <input
            id="ap-org"
            name="org"
            maxLength={120}
            placeholder="e.g. ISA AM · USPAP current through 2027"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="ap-specialty" className="tag text-smoke">Current specialty</label>
          <input
            id="ap-specialty"
            name="specialty"
            maxLength={160}
            placeholder="e.g. contemporary art, memorabilia, streetwear"
            className={field}
          />
        </div>
      </div>
      <div>
        <label htmlFor="ap-links" className="tag text-smoke">
          Links <span className="normal-case">(site, LinkedIn, sample report)</span>
        </label>
        <input id="ap-links" name="links" maxLength={300} className={field} />
      </div>
      <div>
        <label htmlFor="ap-note" className="tag text-smoke">Anything else</label>
        <textarea
          id="ap-note"
          name="note"
          rows={3}
          maxLength={600}
          placeholder="Why this niche interests you, capacity, turnaround…"
          className={field}
        />
      </div>
      {state?.error && <p role="alert" className="text-sm text-heat">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg btn-hard py-3 tag font-bold disabled:opacity-50"
      >
        {pending ? "Sending…" : "Apply to the Network"}
      </button>
    </form>
  );
}
