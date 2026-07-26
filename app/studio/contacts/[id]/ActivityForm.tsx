"use client";

import { useActionState } from "react";
import { logActivityAction, type ActionResult } from "@/app/actions";

const input =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

const KINDS = [
  ["NOTE", "Note"], ["CALL", "Call"], ["DM", "DM"],
  ["EMAIL", "Email"], ["MEETING", "Met up"],
] as const;

export default function ActivityForm({ contactId }: { contactId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    logActivityAction,
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="contactId" value={contactId} />
      <div>
        <label className="tag text-smoke" htmlFor="a-body">What happened</label>
        <input
          id="a-body"
          name="body"
          required
          placeholder="Called about the 4s — wants a bred colourway, has budget around $600"
          className={input}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="tag text-smoke" htmlFor="a-kind">Type</label>
          <select id="a-kind" name="kind" defaultValue="NOTE" className={input}>
            {KINDS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="a-when">When</label>
          {/* Backdating on purpose: writing up yesterday's call needs
              yesterday's date or the timeline quietly lies. */}
          <input id="a-when" name="occurredAt" type="date" className={input} />
        </div>
      </div>
      {state && !state.ok && (
        <p role="alert" className="rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50">
        {pending ? "Saving…" : "Log it"}
      </button>
    </form>
  );
}
