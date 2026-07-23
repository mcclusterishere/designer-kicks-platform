"use client";

import { useActionState } from "react";
import { findLeads, type FindLeadsResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

/**
 * The scout — asks the AI to hunt for custom-sneaker artists matching a
 * brief, already filtered against who's on the chart. One click moves a
 * candidate into the research box below.
 */
export default function LeadFinder() {
  const [state, formAction, pending] = useActionState<FindLeadsResult | null, FormData>(
    findLeads,
    null
  );

  function research(lead: { link: string | null; instagram: string | null }) {
    const url = lead.link || (lead.instagram ? `https://instagram.com/${lead.instagram}` : "");
    const box = document.getElementById("oa-links") as HTMLTextAreaElement | null;
    if (box && url) {
      box.value = url;
      box.scrollIntoView({ behavior: "smooth", block: "center" });
      box.focus();
    }
  }

  // One tap carries the lead straight into the staging form — no
  // retyping what the scout already knows.
  function stage(lead: { name: string; instagram: string | null; city: string | null }) {
    const fill = (id: string, value: string | null) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && value) el.value = value;
    };
    fill("pl-name", lead.name);
    fill("pl-ig", lead.instagram ? `@${lead.instagram}` : null);
    fill("pl-city", lead.city);
    const name = document.getElementById("pl-name");
    name?.scrollIntoView({ behavior: "smooth", block: "center" });
    (document.getElementById("pl-title") as HTMLInputElement | null)?.focus({ preventScroll: true });
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="tag text-smoke" htmlFor="lf-focus">What kind of artist are we looking for?</label>
          <input id="lf-focus" name="focus" maxLength={200}
            placeholder='e.g. "AF1 hand-painters in Atlanta" — or leave blank for anyone great'
            className={inputClass} />
        </div>
        <button type="submit" disabled={pending}
          className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-50">
          {pending ? "Scouting…" : "Find artists"}
        </button>
      </form>

      {state && !state.ok && <p className="text-sm text-heat">{state.error}</p>}
      {state?.ok && (
        <div className="rounded-xl border border-edge bg-panel/40">
          {state.note && <p className="border-b border-edge px-4 py-2 text-xs text-smoke">{state.note}</p>}
          {state.leads.length === 0 ? (
            <p className="p-4 text-sm text-smoke">Everyone it found is already on the chart — nice problem. Try a different brief.</p>
          ) : (
            <div className="divide-y divide-edge/60">
              {state.leads.map((l, i) => (
                <div key={`${l.name}-${i}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">
                      {l.name}
                      {l.city && <span className="text-smoke"> · {l.city}</span>}
                    </p>
                    <p className="truncate text-xs text-smoke">
                      {l.instagram && (
                        <a href={`https://instagram.com/${l.instagram}`} target="_blank" rel="noreferrer"
                          className="text-volt hover:underline">@{l.instagram}</a>
                      )}
                      {l.instagram && l.why && " · "}
                      {l.why}
                    </p>
                  </div>
                  {l.link && (
                    <a href={l.link} target="_blank" rel="noreferrer"
                      className="shrink-0 rounded-lg border border-edge px-3 py-1.5 text-xs text-white hover:border-volt">
                      Look
                    </a>
                  )}
                  <button type="button" onClick={() => research(l)}
                    className="shrink-0 rounded-lg border border-volt/60 bg-volt/10 px-3 py-1.5 text-xs font-bold text-volt">
                    Research →
                  </button>
                  <button type="button" onClick={() => stage(l)}
                    className="shrink-0 rounded-lg bg-volt px-3 py-1.5 text-xs font-bold text-ink">
                    Stage →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
