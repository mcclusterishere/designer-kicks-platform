"use client";

import { useActionState } from "react";
import { saveQuestion, type ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function QuestionForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveQuestion,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="tag text-smoke" htmlFor="q-text">Question *</label>
        <input id="q-text" name="question" required placeholder="What year did the Air Jordan 1 originally release?" className={inputClass} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="answerIndex"
              value={i}
              required
              aria-label={`Option ${String.fromCharCode(65 + i)} is correct`}
              className="h-4 w-4 accent-[#d9b96a]"
            />
            <input
              name={`option${i}`}
              required
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              className={inputClass}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-smoke">Tick the radio next to the correct option.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="tag text-smoke" htmlFor="q-diff">Difficulty</label>
          <select id="q-diff" name="difficulty" className={inputClass}>
            <option value="1">Easy</option>
            <option value="2">Medium</option>
            <option value="3">Hard</option>
          </select>
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="q-cat">Category</label>
          <select id="q-cat" name="category" className={inputClass}>
            <option value="history">History</option>
            <option value="releases">Releases</option>
            <option value="moments">Moments</option>
            <option value="collabs">Collabs</option>
            <option value="culture">Culture</option>
          </select>
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="q-exp">Explanation (shown after answering)</label>
          <input id="q-exp" name="explanation" className={inputClass} />
        </div>
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="text-sm text-volt">Question added.</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-50">
        {pending ? "Adding…" : "Add Question"}
      </button>
    </form>
  );
}
