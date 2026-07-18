"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  startQuizRun,
  answerQuestion,
  resumeRun,
  abandonRun,
  buyCreditPack,
  type QuizState,
  type AnswerFeedback,
} from "@/app/quiz-actions";

const DIFFICULTY = { 1: "Easy", 2: "Medium", 3: "Hard" } as Record<number, string>;

type Props = {
  initialState: QuizState | null;
  purchaseResult: string | null;
  stripeConfigured: boolean;
  purchasesEnabled: boolean;
  questionCount: number;
};

export default function QuizGame({ initialState, purchaseResult, stripeConfigured, purchasesEnabled, questionCount }: Props) {
  const [state, setState] = useState<QuizState | null>(initialState);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean } & Record<string, unknown>>) {
    setError(null);
    startTransition(async () => {
      const res = (await action()) as
        | { ok: true; state: QuizState; feedback?: AnswerFeedback; dev?: boolean }
        | { ok: false; error: string };
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if ("state" in res && res.state) {
        setState(res.state);
        setFeedback(res.feedback ?? null);
        setPicked(null);
      }
    });
  }

  const strikesLeft = state ? state.strikes.freeLeft + state.strikes.credits : 0;

  // ---------- No run yet ----------
  if (!state) {
    return (
      <div className="rounded-xl border border-edge bg-surface p-8 text-center">
        {purchaseResult === "success" && (
          <p className="mb-4 rounded border border-volt/40 bg-volt/10 p-3 text-sm text-volt">
            Payment received — your strikes are loaded.
          </p>
        )}
        <p className="display text-2xl text-white">Think you know Jordans?</p>
        <p className="mt-2 text-sm text-smoke">{questionCount} questions in the bank. No repeats within a run.</p>
        <button
          onClick={() => run(startQuizRun)}
          disabled={pending}
          className="mt-5 rounded-lg bg-heat px-8 py-3.5 tag font-bold text-white glow-heat disabled:opacity-50"
        >
          {pending ? "Loading…" : "Start The Heat Check"}
        </button>
        {error && <p className="mt-3 text-sm text-heat">{error}</p>}
      </div>
    );
  }

  // ---------- Won ----------
  if (state.status === "WON") {
    return (
      <div className="rounded-xl border border-volt bg-surface p-8 text-center glow-volt">
        <p className="display text-4xl text-volt">Heat Check Passed</p>
        <p className="mt-3 text-white">
          {state.correctCount}/{state.target} correct
          {feedback?.earnedEntry
            ? " — your giveaway entry is locked in."
            : state.usedPaidStrikes
              ? " — leaderboard win!"
              : "."}
        </p>
        {state.usedPaidStrikes && !feedback?.earnedEntry && (
          <p className="mx-auto mt-2 max-w-md text-sm text-smoke">
            This run used purchased strikes, so it counts for the
            leaderboard but not the giveaway — entries only come from
            free-strike runs. Run it back tomorrow on free strikes for an
            entry.
          </p>
        )}
        <div className="mt-5 flex justify-center gap-3">
          <button
            onClick={() => run(() => abandonRun(state.runId))}
            disabled={pending}
            className="rounded-lg bg-heat px-6 py-3 tag font-bold text-white disabled:opacity-50"
          >
            Run It Again
          </button>
          <Link href="/giveaway" className="rounded-lg border border-edge px-6 py-3 tag text-white hover:border-volt">
            View Giveaway
          </Link>
        </div>
      </div>
    );
  }

  // ---------- Out of questions ----------
  if (state.status === "OUT_OF_QUESTIONS") {
    return (
      <div className="rounded-xl border border-edge bg-surface p-8 text-center">
        <p className="display text-2xl text-white">Run over</p>
        <p className="mt-2 text-smoke">
          You went {state.correctCount}/{state.target} this run. Fresh questions tomorrow —
          or run it back right now.
        </p>
        <button
          onClick={() => run(() => abandonRun(state.runId))}
          disabled={pending}
          className="mt-5 rounded-lg bg-heat px-6 py-3 tag font-bold text-white disabled:opacity-50"
        >
          New Run
        </button>
      </div>
    );
  }

  // ---------- Needs credits ----------
  if (state.status === "NEEDS_CREDITS") {
    return (
      <div className="rounded-xl border border-heat bg-surface p-8 text-center glow-heat">
        <p className="display text-2xl text-heat">Out of strikes</p>
        <p className="mt-2 text-smoke">
          You&apos;re {state.correctCount}/{state.target} deep — don&apos;t lose the run.
          Grab a credit pack and keep climbing.
        </p>
        <p className="mx-auto mt-3 max-w-md rounded border border-edge bg-panel p-3 text-xs text-smoke">
          Heads up: buying strikes keeps this run alive for the{" "}
          <strong className="text-white">leaderboard</strong>. Giveaway
          entries only come from runs completed on free strikes — purchases
          never affect your odds of winning.
        </p>
        {purchasesEnabled ? (
          <>
            <BuyPanel
              pending={pending}
              stripeConfigured={stripeConfigured}
              onBuy={(packs) =>
                run(async () => {
                  const res = await buyCreditPack(packs);
                  if (res.ok && "dev" in res) {
                    // Dev purchase granted instantly — resume the run.
                    return resumeRun(state.runId);
                  }
                  return res;
                })
              }
            />
            <p className="mt-4 text-xs text-smoke">
              Or come back tomorrow — your free strikes reset daily and the run
              will be waiting.
            </p>
          </>
        ) : (
          <p className="mx-auto mt-5 max-w-md rounded-lg border border-edge bg-panel p-4 text-sm text-smoke">
            Credit packs aren&apos;t on sale yet. Your free strikes refill at
            midnight UTC — this run will be waiting for you.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-heat">{error}</p>}
      </div>
    );
  }

  // ---------- Active question ----------
  const q = state.question;
  if (!q) {
    return (
      <div className="rounded-xl border border-edge bg-surface p-8 text-center">
        <p className="text-smoke">Loading question…</p>
        <button
          onClick={() => run(() => resumeRun(state.runId))}
          className="mt-4 rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Status bar */}
      <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-edge bg-panel px-4 py-3">
        <div className="flex items-center gap-2">
          {Array.from({ length: state.target }, (_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full sm:w-4 ${i < state.correctCount ? "bg-volt" : "bg-edge"}`}
            />
          ))}
        </div>
        <p className="tag text-smoke">
          {state.usedPaidStrikes && (
            <span className="mr-2 rounded bg-heat/20 px-1.5 py-0.5 text-heat">Leaderboard run</span>
          )}
          <span className="text-white">{state.correctCount}</span>/{state.target} ·{" "}
          <span className={strikesLeft <= 1 ? "text-heat" : "text-white"}>
            {state.strikes.freeLeft} free + {state.strikes.credits} credits
          </span>
        </p>
      </div>

      <div className="rounded-b-xl border border-edge bg-surface p-6">
        <p className="tag text-smoke">
          {q.category} · {DIFFICULTY[q.difficulty] ?? "?"}
        </p>
        <h2 data-testid="quiz-question" className="mt-2 text-xl font-bold text-white">{q.question}</h2>

        <div className="mt-5 space-y-3">
          {q.options.map((opt, i) => (
            <button
              key={i}
              disabled={pending}
              onClick={() => {
                setPicked(i);
                run(() => answerQuestion(state.runId, q.id, i));
              }}
              className={`w-full rounded-lg border px-4 py-3 text-left text-white transition disabled:opacity-60 ${
                picked === i ? "border-volt bg-volt/10" : "border-edge bg-panel hover:border-volt/60"
              }`}
            >
              <span className="tag mr-3 text-smoke">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          ))}
        </div>

        {feedback && (
          <div
            className={`mt-5 rounded-lg border p-4 text-sm ${
              feedback.correct
                ? "border-volt/40 bg-volt/10 text-volt"
                : "border-heat/40 bg-heat/10 text-heat"
            }`}
          >
            <p className="font-bold">
              {feedback.correct ? "Correct." : `Wrong — it was: ${feedback.correctAnswer}`}
            </p>
            {feedback.explanation && (
              <p className="mt-1 text-smoke">{feedback.explanation}</p>
            )}
          </div>
        )}
        {error && <p className="mt-4 text-sm text-heat">{error}</p>}
      </div>
    </div>
  );
}

function BuyPanel({
  pending,
  stripeConfigured,
  onBuy,
}: {
  pending: boolean;
  stripeConfigured: boolean;
  onBuy: (packs: number) => void;
}) {
  const [packs, setPacks] = useState(1);
  return (
    <div className="mx-auto mt-5 max-w-sm">
      <div className="flex items-center justify-center gap-3">
        <select
          value={packs}
          onChange={(e) => setPacks(Number(e.target.value))}
          className="rounded-lg border border-edge bg-panel px-3 py-3 text-white"
          aria-label="Number of credit packs"
        >
          {[1, 2, 3, 5].map((n) => (
            <option key={n} value={n}>
              {n} pack{n > 1 ? "s" : ""} — ${n}.00
            </option>
          ))}
        </select>
        <button
          onClick={() => onBuy(packs)}
          disabled={pending}
          className="flex-1 rounded-lg bg-volt px-5 py-3 tag font-bold text-ink disabled:opacity-50"
        >
          {pending ? "Processing…" : `Buy ${packs * 4} Strikes`}
        </button>
      </div>
      {!stripeConfigured && (
        <p className="mt-2 text-xs text-smoke">
          <span className="tag text-heat">Dev mode</span> — Stripe isn&apos;t
          configured, so purchases are granted instantly for testing.
        </p>
      )}
    </div>
  );
}
