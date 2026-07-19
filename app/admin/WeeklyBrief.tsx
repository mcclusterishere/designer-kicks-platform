"use client";

import { useState, useTransition } from "react";
import { generateWeeklyBrief } from "@/app/actions";

/** The Monday note — real numbers, plain speech, one button. */
export default function WeeklyBrief() {
  const [brief, setBrief] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setError(null);
    start(async () => {
      const res = await generateWeeklyBrief();
      if (res.ok) setBrief(res.brief);
      else setError(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-edge bg-panel/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-smoke">Last 7 days, summarized in plain speech — what happened, what to push.</p>
        <button type="button" onClick={run} disabled={pending}
          className="rounded-lg border border-volt/60 bg-volt/10 px-4 py-2 tag font-bold text-volt disabled:opacity-50">
          {pending ? "Reading the numbers…" : "✨ Weekly brief"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-heat">{error}</p>}
      {brief && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg border border-volt/30 bg-surface p-4 text-sm leading-relaxed text-white">
          {brief}
        </p>
      )}
    </div>
  );
}
