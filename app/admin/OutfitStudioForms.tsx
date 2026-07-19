"use client";

import { useActionState, useState } from "react";
import {
  createHouseOutfit,
  createOutfitBattleAction,
  outreachInvite,
  outreachDmScript,
  setArtistStage,
  saveArtistNotes,
  type ActionResult,
  type OutreachResult,
} from "@/app/actions";
import { categoryEmoji, categoryLabel } from "@/lib/categories";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

type PieceOption = {
  id: string;
  title: string;
  category: string;
  artistName: string;
  rank: number | null;
};

export function HouseOutfitForm({ pieces }: { pieces: PieceOption[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createHouseOutfit,
    null
  );
  const byCategory = ["sneakers", "apparel", "headwear", "accessories"].map((c) => ({
    category: c,
    pieces: pieces.filter((p) => p.category === c),
  }));

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="tag text-smoke" htmlFor="ho-name">Fit name *</label>
        <input id="ho-name" name="name" required maxLength={60} placeholder='"All-City Sunday"' className={inputClass} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {byCategory.map((group) => (
          <div key={group.category} className="rounded-lg border border-edge bg-surface p-3">
            <p className="tag text-volt">
              {categoryEmoji(group.category)} {categoryLabel(group.category)}
            </p>
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
              {group.pieces.length === 0 && (
                <p className="text-xs text-smoke">Nothing approved yet.</p>
              )}
              {group.pieces.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm text-smoke hover:text-white">
                  <input type="checkbox" name="pieces" value={p.id} className="h-4 w-4 accent-[#d9b96a]" />
                  <span className="min-w-0 truncate">
                    {p.rank && p.rank <= 3 && <span className="text-volt">#{p.rank} </span>}
                    {p.title} <span className="opacity-60">— {p.artistName}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {state?.ok && <p className="text-sm text-volt">Fit created ✓ — match it below.</p>}
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-50">
        {pending ? "Creating…" : "Create House Fit (2–5 pieces)"}
      </button>
    </form>
  );
}

type OutfitOption = { id: string; name: string; kind: string; itemCount: number; heat: number };

export function OutfitBattleForm({ outfits }: { outfits: OutfitOption[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createOutfitBattleAction,
    null
  );
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {["outfitAId", "outfitBId"].map((field, i) => (
          <div key={field}>
            <label className="tag text-smoke" htmlFor={field}>Fit {i === 0 ? "A" : "B"} *</label>
            <select id={field} name={field} required className={inputClass} defaultValue="">
              <option value="" disabled>Pick a fit</option>
              {outfits.map((o) => (
                <option key={o.id} value={o.id}>
                  [{o.kind === "HOUSE" ? "House" : "Fan"}] {o.name} ({o.itemCount} pieces · {o.heat.toFixed(1)}🔥)
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="ob-title">Billing (optional)</label>
          <input id="ob-title" name="title" maxLength={80} placeholder='"Fit Check Friday"' className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="ob-days">Days</label>
          <input id="ob-days" name="days" type="number" min={1} max={14} defaultValue={3} className={inputClass} />
        </div>
      </div>
      {state?.ok && <p className="text-sm text-volt">Fit battle is live ✓</p>}
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-heat px-5 py-2.5 tag font-bold text-white disabled:opacity-50">
        {pending ? "Matching…" : "Start Fit Battle"}
      </button>
    </form>
  );
}

const STAGES: { key: string; label: string }[] = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "IN_TALKS", label: "In talks" },
  { key: "INVITED", label: "Invited" },
];

const STAGE_CHIP: Record<string, string> = {
  NEW: "border-edge text-smoke",
  CONTACTED: "border-heat/60 text-heat",
  IN_TALKS: "border-volt/60 text-volt",
  INVITED: "border-volt text-volt",
};

export function OutreachRow({
  artistId,
  displayName,
  defaultEmail,
  invitedAgo,
  pageSlug,
  stage,
  notes,
}: {
  artistId: string;
  displayName: string;
  defaultEmail: string;
  invitedAgo: string | null;
  pageSlug: string;
  stage: string;
  notes: string | null;
}) {
  const [state, formAction, pending] = useActionState<OutreachResult | null, FormData>(
    outreachInvite,
    null
  );
  const [notesState, notesAction, notesPending] = useActionState<ActionResult | null, FormData>(
    saveArtistNotes,
    null
  );
  const [dm, setDm] = useState<string | null>(null);
  const [dmBusy, setDmBusy] = useState(false);

  async function loadDm() {
    setDmBusy(true);
    const res = await outreachDmScript(artistId);
    setDm(res.ok ? res.script : res.error);
    setDmBusy(false);
  }

  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-white">
          {displayName}{" "}
          <a href={`/artists/${pageSlug}`} className="tag text-volt underline">page →</a>
        </p>
        <div className="flex items-center gap-2">
          <span className={`tag rounded-full border px-2.5 py-1 ${STAGE_CHIP[stage] ?? STAGE_CHIP.NEW}`}>
            {STAGES.find((s) => s.key === stage)?.label ?? stage}
          </span>
          <p className="tag text-smoke">
            {invitedAgo ? `Invited ${invitedAgo}` : "Never invited"}
          </p>
        </div>
      </div>

      {/* Pipeline: where is this lead right now? */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {STAGES.filter((s) => s.key !== stage && s.key !== "INVITED").map((s) => (
          <form key={s.key} action={setArtistStage.bind(null, artistId, s.key)}>
            <button className="tag rounded border border-edge px-2.5 py-1 text-smoke transition hover:border-volt hover:text-white">
              → {s.label}
            </button>
          </form>
        ))}
        <form action={notesAction} className="flex min-w-0 flex-1 items-center gap-1.5">
          <input type="hidden" name="artistId" value={artistId} />
          <input
            name="notes"
            defaultValue={notes ?? ""}
            placeholder="notes — where it stands, what they said…"
            className="min-w-0 flex-1 rounded border border-edge bg-panel px-2.5 py-1 text-xs text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
          />
          <button disabled={notesPending} className="tag shrink-0 text-volt underline disabled:opacity-50">
            {notesState?.ok ? "saved ✓" : "save"}
          </button>
        </form>
        <button
          type="button"
          onClick={loadDm}
          disabled={dmBusy}
          className="tag rounded border border-volt/50 px-2.5 py-1 text-volt transition hover:border-volt disabled:opacity-50"
        >
          {dmBusy ? "Writing…" : "DM script"}
        </button>
      </div>

      {/* Personalized paste-ready DM — the no-email path. Includes the
          live claim link (reused, never rotated). */}
      {dm && (
        <div className="mt-2">
          <textarea
            readOnly
            value={dm}
            rows={6}
            onFocus={(e) => e.target.select()}
            data-testid="dm-script"
            className="w-full rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-xs text-volt"
          />
        </div>
      )}
      {state?.ok ? (
        <div className="mt-2 space-y-1">
          <p className="text-sm text-volt">
            {state.emailSent
              ? "Invite email sent ✓"
              : "Invite ready — email logged (connect Resend to auto-send). Claim link for a manual DM:"}
          </p>
          {!state.emailSent && state.claimUrl && (
            <input
              readOnly
              value={state.claimUrl}
              onFocus={(e) => e.target.select()}
              className="w-full rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-xs text-volt"
            />
          )}
        </div>
      ) : (
        <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="artistId" value={artistId} />
          <input
            name="email"
            type="email"
            required
            defaultValue={defaultEmail.includes("@theheatchart.com") ? "" : defaultEmail}
            placeholder="lead's real email"
            className="min-w-0 flex-1 rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="tag shrink-0 rounded bg-volt px-4 py-2 font-bold text-ink disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send Invite"}
          </button>
          {state?.error && <p className="w-full text-xs text-heat">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
