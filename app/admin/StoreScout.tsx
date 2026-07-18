"use client";

import { useActionState, useState } from "react";
import {
  scoutStores,
  addStoreLead,
  updateStoreLead,
  sendStoreInvite,
  setStoreStatus,
  type ActionResult,
  type ScoutResult,
  type StoreInviteResult,
} from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export function ScoutForm({ placesReady }: { placesReady: boolean }) {
  const [state, formAction, pending] = useActionState<ScoutResult | null, FormData>(
    scoutStores,
    null
  );
  return (
    <form action={formAction} className="space-y-3">
      {!placesReady && (
        <p className="rounded-lg border border-heat/40 bg-heat/10 p-3 text-xs text-smoke">
          Google Places isn&apos;t connected yet. Add{" "}
          <span className="font-mono text-heat">GOOGLE_PLACES_API_KEY</span> in Railway
          variables (enable &quot;Places API (New)&quot; in Google Cloud — pay-as-you-go
          with a monthly free tier). Until then, add stores by hand below.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="tag text-smoke" htmlFor="sc-zip">Zip code *</label>
          <input id="sc-zip" name="zip" required pattern="\d{5}" maxLength={5} placeholder="30310" className={inputClass} />
        </div>
        <div className="min-w-0 flex-1">
          <label className="tag text-smoke" htmlFor="sc-kw">Looking for</label>
          <input id="sc-kw" name="keyword" maxLength={60} defaultValue="sneaker store" className={inputClass} />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="tag rounded-lg bg-heat px-5 py-2.5 font-bold text-white disabled:opacity-50"
        >
          {pending ? "Scanning…" : "Scan The Area"}
        </button>
      </div>
      {state?.ok && (
        <p className="text-sm text-volt">
          Scan done ✓ — {state.found} store{state.found === 1 ? "" : "s"} found,{" "}
          {state.added} new on the board, {state.noSite} with no website
          (your targets).
        </p>
      )}
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
    </form>
  );
}

export function ManualStoreForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addStoreLead,
    null
  );
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="ms-name">Store name *</label>
          <input id="ms-name" name="name" required maxLength={80} placeholder="Sole Sanctuary ATL" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="ms-addr">Address</label>
          <input id="ms-addr" name="address" maxLength={120} placeholder="123 Edgewood Ave SE, Atlanta, GA" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="tag text-smoke" htmlFor="ms-zip">Zip</label>
          <input id="ms-zip" name="zip" maxLength={5} placeholder="30312" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="ms-phone">Phone</label>
          <input id="ms-phone" name="phone" maxLength={20} placeholder="(404) 555-0134" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="ms-web">Website (leave blank if none)</label>
          <input id="ms-web" name="website" maxLength={120} placeholder="usually blank — that's the target" className={inputClass} />
        </div>
      </div>
      {state?.ok && <p className="text-sm text-volt">Store added to the board ✓</p>}
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button type="submit" disabled={pending} className="tag rounded-lg bg-volt px-5 py-2.5 font-bold text-ink disabled:opacity-50">
        {pending ? "Adding…" : "Add Store By Hand"}
      </button>
    </form>
  );
}

type Lead = {
  id: string;
  name: string;
  address: string | null;
  zip: string | null;
  phone: string | null;
  mapsUrl: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  email: string | null;
  instagram: string | null;
  specialty: string | null;
  notes: string | null;
  status: string;
  invitedAgo: string | null;
};

function researchLinks(lead: Lead) {
  const q = encodeURIComponent(`${lead.name} ${lead.zip ?? ""}`.trim());
  return [
    { label: "Google panel", href: lead.mapsUrl ?? `https://www.google.com/maps/search/${q}` },
    { label: "Brand search", href: `https://www.google.com/search?q=${q}` },
    { label: "Find their IG", href: `https://www.google.com/search?q=${encodeURIComponent(`${lead.name} instagram`)}` },
    { label: "Find their FB", href: `https://www.google.com/search?q=${encodeURIComponent(`${lead.name} facebook`)}` },
  ];
}

const STATUS_STYLE: Record<string, string> = {
  SCOUTED: "border-edge text-smoke",
  QUALIFIED: "border-volt/60 text-volt",
  INVITED: "border-heat/60 text-heat",
  JOINED: "border-volt text-volt",
  PASSED: "border-edge text-smoke/60",
};

export function StoreLeadRow({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const [research, researchAction, researching] = useActionState<ActionResult | null, FormData>(
    updateStoreLead,
    null
  );
  const [invite, inviteAction, inviting] = useActionState<StoreInviteResult | null, FormData>(
    sendStoreInvite,
    null
  );

  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-white">
            {lead.name}{" "}
            {!lead.website ? (
              <span className="sticker px-1.5 py-0.5 text-[10px]">No Website — Target</span>
            ) : (
              <a href={lead.website} target="_blank" rel="noreferrer" className="tag text-smoke underline">
                has a site ↗
              </a>
            )}
          </p>
          <p className="mt-0.5 text-sm text-smoke">
            {lead.address ?? "Address unknown"}
            {lead.rating ? ` · ${lead.rating}★ (${lead.reviewCount ?? 0})` : ""}
            {lead.phone ? ` · ${lead.phone}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`tag rounded-full border px-2.5 py-1 ${STATUS_STYLE[lead.status] ?? "border-edge text-smoke"}`}>
            {lead.status.toLowerCase()}
            {lead.invitedAgo ? ` ${lead.invitedAgo}` : ""}
          </span>
          <button onClick={() => setOpen(!open)} className="tag text-volt underline">
            {open ? "close" : "work this lead"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-4 border-t border-edge pt-3">
          {/* Research shortcuts */}
          <div className="flex flex-wrap gap-2">
            {researchLinks(lead).map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="tag rounded-full border border-edge px-3 py-1.5 text-smoke transition hover:border-volt hover:text-white"
              >
                {l.label} ↗
              </a>
            ))}
          </div>

          {/* Brand research → populated profile */}
          <form action={researchAction} className="space-y-2">
            <input type="hidden" name="id" value={lead.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="tag text-smoke" htmlFor={`em-${lead.id}`}>Email (qualifies the lead)</label>
                <input id={`em-${lead.id}`} name="email" type="email" defaultValue={lead.email ?? ""} placeholder="owner@…" className={inputClass} />
              </div>
              <div>
                <label className="tag text-smoke" htmlFor={`ig-${lead.id}`}>Instagram</label>
                <input id={`ig-${lead.id}`} name="instagram" defaultValue={lead.instagram ?? ""} placeholder="@handle" className={inputClass} />
              </div>
              <div>
                <label className="tag text-smoke" htmlFor={`sp-${lead.id}`}>Specialty</label>
                <input id={`sp-${lead.id}`} name="specialty" defaultValue={lead.specialty ?? ""} placeholder="consignment · customs · kids" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="tag text-smoke" htmlFor={`no-${lead.id}`}>Brand notes</label>
              <textarea id={`no-${lead.id}`} name="notes" rows={2} defaultValue={lead.notes ?? ""} placeholder="Since 2016, heavy Jordan wall, does in-store raffles, owner's name is…" className={inputClass} />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={researching} className="tag rounded-lg border border-volt/50 px-4 py-2 text-white transition hover:border-volt hover:bg-volt/10 disabled:opacity-50">
                {researching ? "Saving…" : "Save Research"}
              </button>
              {research?.ok && <span className="text-sm text-volt">Saved ✓</span>}
              {research?.error && <span className="text-sm text-heat">{research.error}</span>}
            </div>
          </form>

          {/* The invite */}
          {invite?.ok ? (
            <div className="space-y-2 rounded-lg border border-volt/40 bg-volt/5 p-3">
              <p className="text-sm text-volt">
                {invite.emailSent
                  ? "Invite email sent ✓ — they're marked invited."
                  : "Marked invited ✓ — Resend isn't connected, so copy the pitch and send it yourself:"}
              </p>
              {!invite.emailSent && invite.emailText && (
                <textarea
                  readOnly
                  rows={6}
                  value={invite.emailText}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-xs text-smoke"
                />
              )}
            </div>
          ) : (
            <form action={inviteAction} className="flex items-center gap-3">
              <input type="hidden" name="id" value={lead.id} />
              <button
                type="submit"
                disabled={inviting || lead.status === "JOINED"}
                className="tag rounded-lg bg-heat px-5 py-2.5 font-bold text-white disabled:opacity-50"
              >
                {inviting ? "Sending…" : lead.status === "INVITED" ? "Send Again" : "Send Verified-Store Invite"}
              </button>
              {invite?.error && <span className="text-sm text-heat">{invite.error}</span>}
            </form>
          )}

          {/* Pipeline verdicts */}
          <div className="flex gap-2">
            {lead.status !== "JOINED" && (
              <form action={setStoreStatus.bind(null, lead.id, "JOINED")}>
                <button className="tag rounded border border-volt/50 px-3 py-1.5 text-volt transition hover:bg-volt/10">
                  They&apos;re in — mark Joined
                </button>
              </form>
            )}
            {lead.status !== "PASSED" && (
              <form action={setStoreStatus.bind(null, lead.id, "PASSED")}>
                <button className="tag rounded border border-edge px-3 py-1.5 text-smoke transition hover:border-heat hover:text-heat">
                  Pass on this one
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
