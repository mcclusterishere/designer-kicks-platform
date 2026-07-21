"use client";

import Link from "next/link";
import { useActionState } from "react";
import { applyAmbassador } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

const field =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

/**
 * The ambassador application — rendered only for signed-in members.
 * The server re-checks the IQ bar; this form shows the member their
 * live score so the quiz-first path is obvious before they type.
 */
export default function AmbassadorApplyForm({
  iq,
  minIq,
  alreadyApplied,
}: {
  iq: number;
  minIq: number;
  alreadyApplied: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    applyAmbassador,
    null
  );
  const passing = iq >= minIq;

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-volt bg-surface p-6 text-center">
        <p className="display text-2xl text-volt">You&apos;re in the pool ✓</p>
        <p className="mt-2 text-sm text-smoke">
          The league books shoots city by city — you&apos;ll get an email when
          we&apos;re in yours. Keep your Culture IQ climbing: curators are
          picked from the top of the board.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* The culture check — live score vs the bar */}
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          passing ? "border-volt/50 bg-volt/10" : "border-heat/50 bg-heat/10"
        }`}
      >
        <span className="font-bold tabular-nums text-white">
          Your Culture IQ: {iq}
        </span>{" "}
        <span className="text-smoke">· the bar is {minIq}.</span>{" "}
        {passing ? (
          <span className="text-volt">You cleared the culture check — apply below.</span>
        ) : (
          <span className="text-smoke">
            Every right answer is +2 —{" "}
            <Link href="/quiz" className="text-volt underline">
              run the Heat Check
            </Link>{" "}
            until you clear it. That&apos;s the fashion prerequisite; there is no other door.
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="am-ig" className="tag text-smoke">Instagram *</label>
          <input id="am-ig" name="igHandle" required maxLength={40} placeholder="@yourhandle" className={field} />
        </div>
        <div>
          <label htmlFor="am-city" className="tag text-smoke">City *</label>
          <input id="am-city" name="city" required maxLength={60} placeholder="Atlanta, GA" className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="am-links" className="tag text-smoke">
          Portfolio / reels <span className="normal-case">(optional — the shoot is the real audition)</span>
        </label>
        <input id="am-links" name="links" maxLength={300} className={field} />
      </div>
      <div>
        <label htmlFor="am-note" className="tag text-smoke">Anything else</label>
        <textarea id="am-note" name="note" rows={3} maxLength={600} placeholder="Experience, style lanes, availability…" className={field} />
      </div>
      {state?.error && (
        <p role="alert" className="rounded border border-heat/40 bg-heat/10 px-4 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !passing}
        className="w-full rounded-lg btn-hard py-3 tag font-bold disabled:opacity-50"
      >
        {pending ? "Sending…" : alreadyApplied ? "Update My Application" : passing ? "Apply to the Ambassador Class" : `Clear ${minIq} IQ to Apply`}
      </button>
    </form>
  );
}
