"use client";

import { useState } from "react";
import Link from "next/link";
import { clearQuizMiss } from "@/app/actions";

type Miss = { id: string; question: string };

/**
 * The Culture IQ panel: the score that follows you, plus the repair
 * shop — 1 credit clears 1 miss. Cleared questions are burned: the
 * penalty goes, the points never come back, the question never
 * re-appears.
 */
export default function IQPanel({
  iq: initialIq,
  correct,
  misses: initialMisses,
  credits: initialCredits,
}: {
  iq: number;
  correct: number;
  misses: Miss[];
  credits: number;
}) {
  const [iq, setIq] = useState(initialIq);
  const [misses, setMisses] = useState(initialMisses);
  const [credits, setCredits] = useState(initialCredits);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function clear(id: string) {
    setBusy(id);
    setError(null);
    const res = await clearQuizMiss(id);
    if (res.ok) {
      setIq(res.iq);
      setCredits(res.credits);
      setMisses((m) => m.filter((x) => x.id !== id));
    } else {
      setError(res.error);
    }
    setBusy(null);
  }

  return (
    <div className="mt-3 rounded-2xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="display text-4xl text-volt" data-testid="culture-iq">{iq}</p>
          <p className="tag mt-0.5 text-smoke">Culture IQ</p>
        </div>
        <div className="text-right text-sm text-smoke">
          <p>
            <span className="text-white">{correct}</span> correct · +2 each
          </p>
          <p>
            <span className="text-white">{misses.length}</span> miss{misses.length === 1 ? "" : "es"} · −3 each
          </p>
          <p className="tag mt-1">
            {credits} credit{credits === 1 ? "" : "s"} on hand
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-smoke">
        Every culture question in the feed is one shot, forever. Answers
        live in the drop stories — read up before you tap.
      </p>

      {misses.length > 0 && (
        <div className="mt-4">
          <p className="tag text-heat">The repair shop — 1 credit clears 1 miss</p>
          <p className="mt-1 text-xs text-smoke">
            Clearing burns the question: the −3 goes away, but the +2 is
            gone forever and it never comes back around.
          </p>
          <div className="mt-2 space-y-1.5">
            {misses.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-edge bg-panel px-3 py-2"
              >
                <p className="min-w-0 flex-1 truncate text-sm text-white">{m.question}</p>
                <button
                  type="button"
                  onClick={() => clear(m.id)}
                  disabled={busy !== null || credits < 1}
                  className="tag shrink-0 rounded border border-heat/60 px-3 py-1.5 text-heat transition hover:border-heat disabled:opacity-50"
                >
                  {busy === m.id ? "Clearing…" : "Clear · 1 credit"}
                </button>
              </div>
            ))}
          </div>
          {credits < 1 && (
            <p className="mt-2 text-xs text-smoke">
              Out of credits —{" "}
              <Link href="/quiz" className="text-volt underline">grab more on Heat Check</Link>.
            </p>
          )}
          {error && <p className="mt-2 text-sm text-heat">{error}</p>}
        </div>
      )}
    </div>
  );
}
