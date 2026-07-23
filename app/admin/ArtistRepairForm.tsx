"use client";

import { useState } from "react";
import { repairArtistAccount } from "@/app/actions";

/**
 * Admin fix for "my profile is gone" — relink an artist page to the
 * account its owner actually logs in with (and correct the handle in
 * the same pass). The read-only roster above shows each page's current
 * owner email + whether that account can log in, so the mismatch is
 * visible before you touch it.
 */
export default function ArtistRepairForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        setMsg(null);
        const res = await repairArtistAccount(fd);
        setMsg({ ok: res.ok, text: res.ok ? res.note : res.error });
        setPending(false);
      }}
      className="mt-4 grid gap-3 sm:grid-cols-3"
    >
      <label className="text-sm">
        <span className="tag text-smoke">Page slug</span>
        <input
          name="slug"
          required
          placeholder="justin-dekota"
          className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
      </label>
      <label className="text-sm">
        <span className="tag text-smoke">Reassign to login email</span>
        <input
          name="email"
          type="email"
          placeholder="their-real-login@email.com"
          className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
      </label>
      <label className="text-sm">
        <span className="tag text-smoke">Set Instagram (optional)</span>
        <input
          name="instagram"
          placeholder="the_gifted_7"
          className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
      </label>
      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
        >
          {pending ? "Repairing…" : "Repair account link"}
        </button>
        {msg && (
          <p className={`mt-2 text-sm ${msg.ok ? "text-volt" : "text-heat"}`}>{msg.text}</p>
        )}
      </div>
    </form>
  );
}
