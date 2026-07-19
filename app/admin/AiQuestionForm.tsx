"use client";

import { useActionState } from "react";
import { generateQuizQuestions, type QuizGenResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

/** Drafts 5 fact-checked questions; they arrive INACTIVE for review. */
export default function AiQuestionForm() {
  const [state, formAction, pending] = useActionState<QuizGenResult | null, FormData>(
    generateQuizQuestions,
    null
  );
  return (
    <form action={formAction} className="rounded-xl border border-edge bg-panel/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="tag text-smoke" htmlFor="aiq-topic">Draft 5 questions with AI (topic optional)</label>
          <input id="aiq-topic" name="topic" maxLength={160}
            placeholder='e.g. "Jordan 11 history" or "custom techniques"' className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="aiq-diff">Difficulty</label>
          <select id="aiq-diff" name="difficulty" defaultValue="1" className={inputClass}>
            <option value="1">Easy</option>
            <option value="2">Medium</option>
            <option value="3">Hard</option>
          </select>
        </div>
        <button type="submit" disabled={pending}
          className="rounded-lg border border-volt/60 bg-volt/10 px-4 py-2.5 tag font-bold text-volt disabled:opacity-50">
          {pending ? "Drafting…" : "✨ Draft questions"}
        </button>
      </div>
      {state && !state.ok && <p className="mt-2 text-xs text-heat">{state.error}</p>}
      {state?.ok && (
        <p className="mt-2 text-xs text-volt">
          {state.created}{" "}drafted — they&apos;re OFF until you review and switch each one on below.
        </p>
      )}
    </form>
  );
}
