"use client";

import { useActionState, useState } from "react";
import { submitCommissionRequest } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

const field =
  "w-full min-w-0 rounded-md border border-edge bg-surface px-2.5 py-2 text-sm text-white placeholder:text-smoke/60 focus:border-volt focus:outline-none";

/**
 * The commission ticket — the marketplace turned into a customizing
 * machine. Fan names the base pair, the budget, and the idea; the
 * artist accepts from the Studio; the base ships to the artist and the
 * chart gets another one-of-one.
 */
export default function CommissionForm({
  artistId,
  artistName,
}: {
  artistId: string;
  artistName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    submitCommissionRequest,
    null
  );

  if (state?.ok) {
    return (
      <p className="tag mt-4 rounded border border-volt/50 bg-volt/10 px-3 py-2 text-volt">
        Request sent ✓ — {artistName} will accept or pass, and you&apos;ll get
        the next steps by email.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tag mt-4 w-full rounded-lg border border-volt/60 py-3 font-bold text-volt transition hover:bg-volt/10 sm:w-auto sm:px-6"
      >
        Commission a Custom
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-4 max-w-md space-y-2 rounded-xl border border-volt/40 bg-volt/5 p-4">
      <input type="hidden" name="artistId" value={artistId} />
      <p className="text-xs leading-relaxed text-smoke">
        Pick the base, set your budget, pitch the idea. If {artistName}{" "}
        accepts, you buy the base pair (we&apos;ll send an eBay link) and
        ship it straight to them — the chart handles the rest.
      </p>
      <input
        name="baseName"
        required
        maxLength={120}
        placeholder='base pair — e.g. "Air Force 1 Triple White, US 10"'
        aria-label="Base pair to customize"
        className={field}
      />
      <input
        name="budget"
        inputMode="numeric"
        placeholder="budget for the work $ (optional)"
        aria-label="Budget in dollars"
        className={field}
      />
      <textarea
        name="note"
        rows={3}
        maxLength={500}
        placeholder="the idea — colors, theme, story…"
        aria-label="Your idea for the custom"
        className={field}
      />
      <button
        type="submit"
        disabled={pending}
        className="tag w-full rounded-md btn-hard py-2.5 font-bold disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send Commission Request"}
      </button>
      {state?.error && <p role="alert" className="text-xs text-heat">{state.error}</p>}
    </form>
  );
}
