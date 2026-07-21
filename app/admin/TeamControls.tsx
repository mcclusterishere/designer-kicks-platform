"use client";

import { useActionState } from "react";
import { grantEditor, saveJob, type ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export function GrantEditorForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(grantEditor, null);
  return (
    <div className="space-y-3">
      <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="tag text-smoke" htmlFor="ge-email">Editor email *</label>
          <input id="ge-email" name="email" type="email" required placeholder="name@email.com" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="ge-name">Name (optional)</label>
          <input id="ge-name" name="name" maxLength={80} placeholder="Their name" className={inputClass} />
        </div>
        <button type="submit" disabled={pending}
          className="h-[42px] rounded-lg btn-hard px-5 tag font-bold disabled:opacity-50">
          {pending ? "…" : "Make editor"}
        </button>
      </form>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      {state?.ok && state.note && (
        <div className="rounded-lg border border-volt/40 bg-volt/10 p-3">
          <p className="text-sm text-volt">Done.</p>
          <textarea readOnly value={state.note} rows={2} onFocus={(e) => e.target.select()}
            className="mt-2 w-full rounded border border-edge bg-panel px-2 py-1.5 font-mono text-xs text-white" />
          <p className="mt-1 tag text-smoke">If there&apos;s a link, copy it and send it to them to set their password.</p>
        </div>
      )}
    </div>
  );
}

export function NewJobForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveJob, null);
  if (state?.ok) {
    return <p className="rounded-lg border border-volt/40 bg-volt/10 px-3 py-2 text-sm text-volt">{state.note} Refresh to add another.</p>;
  }
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="nj-title">Title *</label>
          <input id="nj-title" name="title" required maxLength={120} placeholder="Editor / Intern" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="nj-pay">Pay line</label>
          <input id="nj-pay" name="payLine" maxLength={120} placeholder="$1 per social post — up to $6/day" className={inputClass} />
        </div>
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="nj-loc">Location</label>
        <input id="nj-loc" name="location" maxLength={80} placeholder="Remote" className={inputClass} />
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="nj-body">Description (Markdown) *</label>
        <textarea id="nj-body" name="body" required rows={6} placeholder={"## What you'll do\n\n- ..."} className={`${inputClass} font-mono`} />
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50">
        {pending ? "Posting…" : "Post job"}
      </button>
    </form>
  );
}
