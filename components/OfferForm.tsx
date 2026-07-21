"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { placeOffer } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

/**
 * The bid ticket — mobile-first. Collapsed it's one full-width tap;
 * open it's quick-bid chips (a thumb never has to type) plus a manual
 * amount. Bids are standing orders the seller can execute against with
 * one tap of Sell Now — no money moves on-platform yet.
 */
export default function OfferForm({
  submissionId,
  signedIn,
  highBidCents = null,
}: {
  submissionId: string;
  signedIn: boolean;
  highBidCents?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    placeOffer,
    null
  );

  if (state?.ok) {
    return (
      <p className="tag mt-3 rounded border border-volt/50 bg-volt/10 px-3 py-2 text-volt">
        Bid in ✓ — it stands until the seller sells or you pull it.
      </p>
    );
  }

  if (!signedIn) {
    return (
      <Link
        href="/signin"
        className="tag mt-3 block rounded border border-edge px-3 py-2.5 text-center text-smoke transition hover:border-volt hover:text-white"
      >
        Sign in to bid
      </Link>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tag mt-3 w-full rounded border border-volt/60 px-3 py-2.5 font-bold text-volt transition hover:bg-volt/10"
      >
        Place Bid{highBidCents ? ` · high $${Math.round(highBidCents / 100)}` : ""}
      </button>
    );
  }

  // Thumb-first amounts: beat the high bid in one tap, or open the book.
  const high = highBidCents ? Math.round(highBidCents / 100) : null;
  const quicks = high ? [high + 25, high + 50, high + 100] : [50, 100, 250];

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      <div className="grid grid-cols-3 gap-1.5">
        {quicks.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setAmount(String(q))}
            className={`rounded-md border py-2 text-sm font-bold tabular-nums transition ${
              amount === String(q)
                ? "border-volt bg-volt/15 text-volt"
                : "border-edge text-white hover:border-volt"
            }`}
          >
            ${q}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          name="amount"
          required
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Your bid in dollars"
          placeholder={high ? `beat $${high}` : "your bid $"}
          className="w-full min-w-0 rounded-md border border-edge bg-panel px-3 py-2.5 text-sm tabular-nums text-white placeholder:text-smoke/60 focus:border-volt focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="tag shrink-0 rounded-md btn-hard px-4 py-2.5 font-bold disabled:opacity-50"
        >
          {pending ? "…" : "Bid"}
        </button>
      </div>
      {state?.error && <p role="alert" className="text-xs text-heat">{state.error}</p>}
    </form>
  );
}
