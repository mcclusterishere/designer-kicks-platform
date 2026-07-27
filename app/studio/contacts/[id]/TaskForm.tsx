"use client";

import { useActionState } from "react";
import { addTaskAction, type ActionResult } from "@/app/actions";

const input =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function TaskForm({ contactId }: { contactId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addTaskAction,
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="contactId" value={contactId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className="tag text-smoke" htmlFor="t-title">Remind me to</label>
          <input id="t-title" name="title" required placeholder="Send the mockup" className={input} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="t-due">By</label>
          <input id="t-due" name="dueAt" type="date" className={input} />
          <p className="mt-1 text-[11px] text-smoke">Blank = a week from now.</p>
        </div>
      </div>
      {state && !state.ok && (
        <p role="alert" className="rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="rounded-lg border border-volt px-5 py-2.5 tag font-bold text-volt transition hover:bg-volt/10 disabled:opacity-50">
        {pending ? "Saving…" : "Set reminder"}
      </button>
    </form>
  );
}
