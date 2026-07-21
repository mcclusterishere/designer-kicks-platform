"use client";

import { useState, useTransition } from "react";
import { acceptHighestBid } from "@/app/actions";

/**
 * The market order. Two taps, on purpose: "Sell Now $X" arms it, the
 * confirm executes against the highest standing bid — sale records as
 * PENDING, the buyer confirms from their account, ownership + payment
 * settle between the two of them exactly like an accepted offer.
 */
export default function SellNowButton({
  submissionId,
  highBidCents,
  bidCount,
}: {
  submissionId: string;
  highBidCents: number;
  bidCount: number;
}) {
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const high = Math.round(highBidCents / 100);

  if (result) {
    return (
      <p className="tag mt-2 rounded border border-volt/50 bg-volt/10 px-3 py-2 text-volt">
        {result}
      </p>
    );
  }

  if (!armed) {
    return (
      <button
        onClick={() => setArmed(true)}
        className="tag mt-2 w-full rounded-md border border-emerald-500/60 py-2.5 font-bold text-emerald-400 transition hover:bg-emerald-500/10"
      >
        Sell Now ${high} · {bidCount} bid{bidCount === 1 ? "" : "s"}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2.5">
      <p className="text-xs leading-relaxed text-smoke">
        Execute at the highest bid — <span className="font-bold tabular-nums text-white">${high}</span>?
        The rest of the book closes, the buyer confirms from their account,
        and you two settle payment directly.
      </p>
      <div className="mt-2 flex gap-1.5">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await acceptHighestBid(submissionId);
              if (res.ok) setResult(`Sold at $${high} — buyer's been pinged to confirm.`);
              else setError(res.error ?? "Couldn't execute.");
            })
          }
          className="tag flex-1 rounded-md bg-emerald-500 py-2 font-bold text-ink disabled:opacity-50"
        >
          {pending ? "Executing…" : `Confirm — Sell $${high}`}
        </button>
        <button
          onClick={() => setArmed(false)}
          className="tag rounded-md border border-edge px-3 py-2 text-smoke"
        >
          Keep
        </button>
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs text-heat">{error}</p>}
    </div>
  );
}
