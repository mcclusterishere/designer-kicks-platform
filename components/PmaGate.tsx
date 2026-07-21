"use client";

import { useState, useTransition } from "react";
import { acceptPma } from "@/app/account-actions";

/**
 * The membership door for accounts that never saw the signup checkbox —
 * OAuth joins and accounts older than the association. Blocks the UI
 * with a bottom sheet until the member agrees; one tap, stamped once,
 * never asked again. Declining just signs the choice is theirs — the
 * sheet stays.
 */
export default function PmaGate() {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pma-title"
        className="w-full max-w-lg rounded-t-2xl border border-edge bg-surface p-6 shadow-2xl sm:rounded-2xl"
      >
        <p className="tag text-volt">Equity Uprise</p>
        <h2 id="pma-title" className="display mt-1 text-2xl text-white">
          One more thing — membership
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-smoke">
          The Heat Chart operates as a program of{" "}
          <span className="text-white">Equity Uprise</span>, a private member
          association. Every account holder is a private member — that&apos;s
          what keeps this space ours. Give the agreement a read, then confirm
          to keep rolling.
        </p>
        <a
          href="/equity-uprise"
          target="_blank"
          className="mt-3 block text-sm text-volt underline"
        >
          Read the Membership Agreement →
        </a>
        <button
          onClick={() => start(async () => {
            const res = await acceptPma();
            if (res.ok) setDone(true);
          })}
          disabled={pending}
          className="mt-5 w-full rounded-lg btn-hard py-3 tag font-bold disabled:opacity-50"
        >
          {pending ? "Confirming…" : "I Agree — Continue as a Member"}
        </button>
        <p className="mt-2 text-center text-[11px] text-smoke/70">
          Agreeing records today&apos;s date on your account as your
          membership acceptance.
        </p>
      </div>
    </div>
  );
}
