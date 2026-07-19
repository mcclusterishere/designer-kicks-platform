"use client";

import { useActionState } from "react";
import { sendEditorMessage, type ActionResult } from "@/app/actions";

type Msg = { id: string; body: string; fromAdmin: boolean; ago: string };

export default function MessageOffice({ thread }: { thread: Msg[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    sendEditorMessage,
    null
  );

  return (
    <div className="space-y-4">
      {thread.length > 0 && (
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-edge bg-panel p-3">
          {thread.map((m) => (
            <div key={m.id} className={`flex ${m.fromAdmin ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.fromAdmin ? "bg-surface text-white" : "bg-volt/15 text-white"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 tag text-smoke/60">
                  {m.fromAdmin ? "Office" : "You"} · {m.ago}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <form action={formAction} className="space-y-2">
        <textarea
          name="body"
          required
          maxLength={2000}
          rows={3}
          placeholder="Message the league office…"
          className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
        {state?.error && <p className="text-sm text-heat">{state.error}</p>}
        {state?.ok && <p className="text-sm text-volt">{state.note}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send to office"}
        </button>
      </form>
    </div>
  );
}
