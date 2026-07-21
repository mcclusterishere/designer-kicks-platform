"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { placeOffer } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

export default function OfferForm({
  submissionId,
  signedIn,
}: {
  submissionId: string;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    placeOffer,
    null
  );

  if (state?.ok) {
    return (
      <p className="tag mt-3 rounded border border-volt/50 bg-volt/10 px-3 py-2 text-volt">
        Offer in ✓ — the seller&apos;s been pinged.
      </p>
    );
  }

  if (!signedIn) {
    return (
      <Link
        href="/signin"
        className="tag mt-3 block rounded border border-edge px-3 py-2 text-center text-smoke transition hover:border-volt hover:text-white"
      >
        Sign in to make an offer
      </Link>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tag mt-3 w-full rounded border border-edge px-3 py-2 text-smoke transition hover:border-volt hover:text-white"
      >
        Make an Offer
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex items-center gap-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input
        name="amount"
        required
        inputMode="decimal"
        aria-label="Your offer in dollars"
        placeholder="your offer $"
        className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke focus:border-volt focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="tag shrink-0 rounded btn-hard px-3 py-2 font-bold disabled:opacity-50"
      >
        {pending ? "…" : "Offer"}
      </button>
      {state?.error && <span role="alert" className="text-xs text-heat">{state.error}</span>}
    </form>
  );
}
