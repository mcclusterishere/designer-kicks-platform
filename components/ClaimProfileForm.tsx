"use client";

import { useActionState, useState } from "react";
import { submitArtistClaim } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

/**
 * Shown only on unclaimed (pre-loaded) artist pages. The real artist
 * files a claim; it lands in the admin's verification queue.
 */
export default function ClaimProfileForm({
  artistId,
  displayName,
}: {
  artistId: string;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    submitArtistClaim,
    null
  );

  if (state?.ok) {
    return (
      <div className="mt-8 rounded-xl border border-volt/50 bg-volt/5 p-5 text-center">
        <p className="display text-xl text-volt">Claim received ✓</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-smoke">
          The league office reviews every claim. Once verified, your
          password-setting link goes to the email you gave — then this page
          is yours.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-volt/40 bg-surface p-5">
        <div>
          <p className="display text-lg text-white">
            Are you {displayName}?
          </p>
          <p className="text-sm text-smoke">
            This page was set up for the artist and is unclaimed. Prove
            it&apos;s you and take the keys.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="btn-hard rounded-lg px-5 py-2.5 tag font-bold"
        >
          Claim This Page
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-8 space-y-3 rounded-xl border border-volt/40 bg-surface p-5"
    >
      <p className="display text-lg text-white">Claim the {displayName} page</p>
      <input type="hidden" name="artistId" value={artistId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="cl-name">Your name *</label>
          <input id="cl-name" name="name" required maxLength={60} className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="cl-email">Email * (becomes your login)</label>
          <input id="cl-email" name="email" type="email" required className={inputClass} />
        </div>
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="cl-proof">
          Proof it&apos;s you * <span className="normal-case">(your Instagram, shop link, or page we can match)</span>
        </label>
        <input id="cl-proof" name="socialProof" required maxLength={120} placeholder="@yourhandle or https://yourshop.com" className={inputClass} />
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="cl-msg">Anything else (optional)</label>
        <input id="cl-msg" name="message" maxLength={400} className={inputClass} />
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="btn-hard w-full rounded-lg py-3 tag font-bold disabled:opacity-50"
      >
        {pending ? "Sending…" : "Submit Claim For Verification"}
      </button>
    </form>
  );
}
