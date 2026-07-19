"use client";

import { useActionState } from "react";
import {
  researchProspect,
  createResearchedProfile,
  type ResearchResult,
  type PreloadDraftResult,
} from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-wider text-smoke";

export default function OnboardAgent() {
  const [research, researchAction, researching] = useActionState<ResearchResult | null, FormData>(
    researchProspect,
    null
  );
  const [created, createAction, creating] = useActionState<PreloadDraftResult | null, FormData>(
    createResearchedProfile,
    null
  );

  const draft = research?.ok ? research.draft : null;

  return (
    <div className="rounded-xl border border-volt/40 bg-panel/40 p-5">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-volt" />
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-volt">Onboarding Agent</p>
      </div>
      <p className="mt-1 text-sm text-smoke">
        Paste their social links (and anything you know) — the agent researches and drafts a whole
        profile. Review it, add their email, and preload the page in one click.
      </p>

      {/* Step 1 — research */}
      <form action={researchAction} className="mt-4 space-y-3">
        <div>
          <label className={labelClass} htmlFor="oa-links">Social / portfolio links (one per line)</label>
          <textarea id="oa-links" name="links" rows={3}
            placeholder={"https://instagram.com/theirhandle\nhttps://linktr.ee/them"} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="oa-hints">Anything you already know (optional)</label>
          <input id="oa-hints" name="hints" maxLength={400}
            placeholder="e.g. based in Atlanta, does AF1 hand-paints" className={inputClass} />
        </div>
        <button type="submit" disabled={researching}
          className="rounded-lg bg-volt px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-ink disabled:opacity-50">
          {researching ? "Researching…" : "Research with AI"}
        </button>
        {research && !research.ok && (
          <p className={`rounded border px-3 py-2 text-sm ${research.dormant ? "border-edge bg-surface text-smoke" : "border-heat/40 bg-heat/10 text-heat"}`}>
            {research.error}
          </p>
        )}
      </form>

      {/* Step 2 — review the draft + preload */}
      {draft && (
        <form key={JSON.stringify(draft)} action={createAction} className="mt-5 space-y-3 border-t border-edge pt-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wider text-volt">Draft — edit anything, then preload</p>
            <span className={`tag rounded-full border px-2 py-0.5 ${
              draft.confidence === "high" ? "border-volt/50 text-volt" : draft.confidence === "medium" ? "border-edge text-white" : "border-heat/40 text-heat"
            }`}>
              {draft.confidence} confidence
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Artist name *</label>
              <input name="artistName" required defaultValue={draft.displayName ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email * (their claimable account)</label>
              <input name="email" type="email" required defaultValue={draft.suggestedEmail ?? ""}
                placeholder="you'll usually add this" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Instagram handle</label>
              <input name="instagram" defaultValue={draft.instagram ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input name="city" defaultValue={draft.city ?? ""} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Bio</label>
            <textarea name="bio" rows={2} defaultValue={draft.bio ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Portfolio / shop link</label>
            <input name="portfolioUrl" defaultValue={draft.portfolioUrl ?? ""} placeholder="https://…" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Outreach notes {draft.outreachAngle && <span className="text-volt">· agent suggests an angle</span>}</label>
            <textarea name="notes" rows={2}
              defaultValue={[draft.specialty && `Makes: ${draft.specialty}`, draft.outreachAngle].filter(Boolean).join(" — ")}
              className={inputClass} />
          </div>
          {draft.sources.length > 0 && (
            <p className="text-[11px] text-smoke/70">
              Sources:{" "}
              {draft.sources.map((s, i) => (
                <a key={i} href={s} target="_blank" rel="noopener noreferrer" className="mr-1.5 text-volt underline">
                  [{i + 1}]
                </a>
              ))}
            </p>
          )}
          <button type="submit" disabled={creating}
            className="rounded-lg bg-volt px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-ink disabled:opacity-50">
            {creating ? "Preloading…" : "Preload this profile"}
          </button>
        </form>
      )}

      {/* Result */}
      {created && !created.ok && <p className="mt-3 text-sm text-heat">{created.error}</p>}
      {created?.ok && (
        <div className="mt-4 space-y-2 rounded-lg border border-volt/40 bg-volt/10 p-3">
          <p className="text-sm text-volt">{created.note}</p>
          {created.artistUrl && (
            <p className="text-xs text-smoke">
              Page: <a href={created.artistUrl} target="_blank" rel="noopener noreferrer" className="text-volt underline">{created.artistUrl}</a>
            </p>
          )}
          {created.claimUrl && (
            <div>
              <p className={labelClass}>Set-password link to send them</p>
              <textarea readOnly rows={2} value={created.claimUrl} onFocus={(e) => e.target.select()}
                className="mt-1 w-full rounded border border-edge bg-panel px-2 py-1.5 font-mono text-xs text-white" />
            </div>
          )}
          <p className="text-xs text-smoke">Refresh to see them in the pipeline below.</p>
        </div>
      )}
    </div>
  );
}
