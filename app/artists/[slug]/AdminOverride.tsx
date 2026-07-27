"use client";

import { useActionState, useState } from "react";
import { adminUpdateArtist, type ActionResult } from "@/app/actions";

/**
 * THE OVERRIDE PANEL — what the admin sees standing on somebody's page.
 *
 * Deliberately unlike anything a member ever sees: hazard striping, the
 * word ADMIN, and the person's own fields sitting there editable. The
 * desk comes to the page instead of the page being managed from a
 * separate screen.
 *
 * Folded shut by default so the page still reads as the artist's page;
 * one tap opens the controls.
 */
export default function AdminOverride({
  artist,
}: {
  artist: {
    id: string;
    slug: string;
    displayName: string;
    bio: string | null;
    instagram: string | null;
    city: string | null;
    portfolioUrl: string | null;
    status: string;
    plan: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    adminUpdateArtist,
    null
  );
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(artist.displayName);

  const field =
    "mt-1 w-full rounded-lg border border-heat/40 bg-ink px-3 py-2 text-sm text-white focus:border-heat focus:outline-none";
  const label = "tag text-[10px] text-heat/80";

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border-2 border-heat bg-heat/[0.06]">
      {/* Hazard bar — an admin should never be unsure which mode they're in */}
      <div
        className="h-1.5 w-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #ff4d3d 0 10px, transparent 10px 20px)",
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-heat px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink">
            Admin
          </span>
          <p className="text-sm text-white">
            You have full control of{" "}
            <span className="font-bold">{artist.displayName}</span>&rsquo;s page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-heat px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-heat transition hover:bg-heat hover:text-ink"
        >
          {open ? "Close controls" : "Edit this page"}
        </button>
      </div>

      {open && (
        <form action={formAction} className="space-y-3 border-t border-heat/30 px-4 py-4">
          <input type="hidden" name="artistId" value={artist.id} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ao-name" className={label}>Display name</label>
              <input
                id="ao-name"
                name="displayName"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label htmlFor="ao-slug" className={label}>
                Handle (the URL) — only re-slugs if the name changed
              </label>
              <input
                id="ao-slug"
                name="slug"
                maxLength={80}
                defaultValue={artist.slug}
                className={field}
              />
              <p className="mt-1 text-[11px] text-smoke">
                Changing this breaks every link already pointing at the old one.
              </p>
            </div>
            <div>
              <label htmlFor="ao-ig" className={label}>Instagram</label>
              <input id="ao-ig" name="instagram" maxLength={60} defaultValue={artist.instagram ?? ""} className={field} />
            </div>
            <div>
              <label htmlFor="ao-city" className={label}>City</label>
              <input id="ao-city" name="city" maxLength={80} defaultValue={artist.city ?? ""} className={field} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ao-portfolio" className={label}>Portfolio link</label>
              <input id="ao-portfolio" name="portfolioUrl" maxLength={300} defaultValue={artist.portfolioUrl ?? ""} className={field} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ao-bio" className={label}>Bio</label>
              <textarea id="ao-bio" name="bio" rows={3} maxLength={1200} defaultValue={artist.bio ?? ""} className={field} />
            </div>
            <div>
              <label htmlFor="ao-status" className={label}>Standing</label>
              <select id="ao-status" name="status" defaultValue={artist.status} className={field}>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div>
              <label htmlFor="ao-plan" className={label}>Plan</label>
              <select id="ao-plan" name="plan" defaultValue={artist.plan} className={field}>
                <option value="FREE">Free</option>
                <option value="PRO">Pro</option>
              </select>
            </div>
          </div>

          {state?.error && <p className="text-sm font-bold text-heat">{state.error}</p>}
          {state?.ok && <p className="text-sm font-bold text-volt">Saved — the page is updated.</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-heat px-5 py-2.5 text-xs font-extrabold uppercase tracking-wide text-ink disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
            <p className="text-[11px] text-smoke">
              Every edit here is written to the audit log under your name.
            </p>
          </div>
        </form>
      )}

      {/* Photos are added per piece, further down the page — say so, so an
          admin isn't hunting for a control that lives somewhere else. */}
      <p className="border-t border-heat/20 px-4 py-2 text-[11px] text-smoke">
        Photos: every piece below carries an <span className="text-heat">Add photos</span> control while
        you&rsquo;re in admin mode.
      </p>
    </div>
  );
}
