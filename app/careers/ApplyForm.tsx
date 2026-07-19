"use client";

import { useActionState } from "react";
import { applyToJob, type ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function ApplyForm({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    applyToJob,
    null
  );

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-volt/50 bg-surface p-5 text-center">
        <p className="display text-xl text-volt">You&apos;re in the running</p>
        <p className="mt-1 text-sm text-smoke">{state.note}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor={`ap-name-${jobId}`}>Name *</label>
          <input id={`ap-name-${jobId}`} name="name" required maxLength={120} className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor={`ap-email-${jobId}`}>Email *</label>
          <input id={`ap-email-${jobId}`} name="email" type="email" required maxLength={160} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="tag text-smoke" htmlFor={`ap-links-${jobId}`}>Socials / portfolio</label>
        <input id={`ap-links-${jobId}`} name="links" maxLength={400} placeholder="@handle, links, anything that shows your work" className={inputClass} />
      </div>
      <div>
        <label className="tag text-smoke" htmlFor={`ap-pitch-${jobId}`}>Why you</label>
        <textarea id={`ap-pitch-${jobId}`} name="pitch" rows={3} maxLength={1500}
          placeholder={`A couple lines on why you'd be good at "${jobTitle}"`} className={inputClass} />
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="rounded-lg bg-volt px-6 py-2.5 tag font-bold text-ink disabled:opacity-50">
        {pending ? "Sending…" : "Apply"}
      </button>
    </form>
  );
}
