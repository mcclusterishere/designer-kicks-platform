"use client";

import { useActionState } from "react";
import {
  addGroupLead,
  setGroupStage,
  saveGroupNotes,
  deleteGroupLead,
  type ActionResult,
} from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

const STAGES: { key: string; label: string }[] = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "IN_TALKS", label: "In talks" },
  { key: "POSTED", label: "Posted" },
];

const STAGE_CHIP: Record<string, string> = {
  NEW: "border-edge text-smoke",
  CONTACTED: "border-heat/60 text-heat",
  IN_TALKS: "border-volt/60 text-volt",
  POSTED: "border-volt text-volt",
};

export type GroupRow = {
  id: string;
  name: string;
  url: string | null;
  adminName: string | null;
  members: string | null;
  stage: string;
  notes: string | null;
  taggedLink: string;
  clicks7: number;
};

export function GroupForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addGroupLead,
    null
  );
  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <div>
        <label className="tag text-smoke" htmlFor="gr-name">Group name *</label>
        <input id="gr-name" name="name" required maxLength={80} placeholder='"Custom Kicks Nation"' className={inputClass} />
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="gr-url">Group link</label>
        <input id="gr-url" name="url" placeholder="https://facebook.com/groups/…" className={inputClass} />
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="gr-admin">Admin name(s)</label>
        <input id="gr-admin" name="adminName" maxLength={80} className={inputClass} />
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="gr-members">Members</label>
        <input id="gr-members" name="members" maxLength={20} placeholder="12K" className={inputClass} />
      </div>
      {state?.error && <p className="text-sm text-heat sm:col-span-4">{state.error}</p>}
      <div className="sm:col-span-4">
        <button disabled={pending} className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50">
          {pending ? "Adding…" : "Track This Group"}
        </button>
      </div>
    </form>
  );
}

export function GroupLeadRow({ group }: { group: GroupRow }) {
  const [notesState, notesAction, notesPending] = useActionState<ActionResult | null, FormData>(
    saveGroupNotes,
    null
  );
  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 font-bold text-white">
          {group.name}
          {group.members && <span className="tag text-smoke"> · {group.members}</span>}
          {group.adminName && <span className="tag text-smoke"> · admin: {group.adminName}</span>}{" "}
          {group.url && (
            <a href={group.url} target="_blank" rel="noopener noreferrer" className="tag text-volt underline">
              group →
            </a>
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className="tag text-smoke" title="Clicks on this group's tagged link, last 7 days">
            {group.clicks7} clicks/7d
          </span>
          <span className={`tag rounded-full border px-2.5 py-1 ${STAGE_CHIP[group.stage] ?? STAGE_CHIP.NEW}`}>
            {STAGES.find((s) => s.key === group.stage)?.label ?? group.stage}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {STAGES.filter((s) => s.key !== group.stage).map((s) => (
          <form key={s.key} action={setGroupStage.bind(null, group.id, s.key)}>
            <button className="tag rounded border border-edge px-2.5 py-1 text-smoke transition hover:border-volt hover:text-white">
              → {s.label}
            </button>
          </form>
        ))}
        <form action={notesAction} className="flex min-w-0 flex-1 items-center gap-1.5">
          <input type="hidden" name="groupId" value={group.id} />
          <input
            name="notes"
            defaultValue={group.notes ?? ""}
            placeholder="notes — who runs it, what landed, next move…"
            className="min-w-0 flex-1 rounded border border-edge bg-panel px-2.5 py-1 text-xs text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
          />
          <button disabled={notesPending} className="tag shrink-0 text-volt underline disabled:opacity-50">
            {notesState?.ok ? "saved ✓" : "save"}
          </button>
        </form>
        <form action={deleteGroupLead.bind(null, group.id)}>
          <button className="tag text-heat underline" aria-label={`Remove group ${group.name}`}>
            remove
          </button>
        </form>
      </div>

      <div className="mt-2">
        <p className="tag text-smoke/70">Tagged link — use this in every post/DM for this group:</p>
        <input
          readOnly
          value={group.taggedLink}
          onFocus={(e) => e.target.select()}
          className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-xs text-volt"
        />
      </div>
    </div>
  );
}
