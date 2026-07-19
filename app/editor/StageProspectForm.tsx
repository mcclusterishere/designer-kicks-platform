"use client";

import { useActionState } from "react";
import { stageProspect, type ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function StageProspectForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    stageProspect,
    null
  );

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-volt/50 bg-surface p-4 text-sm text-volt">
        {state.note} <span className="text-smoke">Refresh to stage another.</span>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="sp-name">Name / handle *</label>
          <input id="sp-name" name="name" required maxLength={120} placeholder="Artist or shop name" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="sp-platform">Platform</label>
          <select id="sp-platform" name="platform" className={inputClass} defaultValue="">
            <option value="">—</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
            <option value="email">Email</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="sp-handle">@handle / profile URL</label>
          <input id="sp-handle" name="handle" maxLength={200} placeholder="@theirhandle" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="sp-contact">Contact (email / DM)</label>
          <input id="sp-contact" name="contact" maxLength={200} placeholder="how to reach them" className={inputClass} />
        </div>
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="sp-notes">Notes</label>
        <textarea id="sp-notes" name="notes" rows={3} maxLength={1000}
          placeholder="Why they're a fit, what to say, anything the office should know…" className={inputClass} />
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="sp-file">Attach a file (media kit / screenshot — JPG/PNG/WebP)</label>
        <input id="sp-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" className={inputClass} />
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-50">
        {pending ? "Staging…" : "Stage for the office"}
      </button>
      <p className="text-xs text-smoke">
        Staged prospects go to the league office to review and send — you're
        teeing them up, not sending directly.
      </p>
    </form>
  );
}
