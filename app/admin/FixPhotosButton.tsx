"use client";

import { useActionState } from "react";
import { fixUploadedPhotos, type ActionResult } from "@/app/actions";

/**
 * One-tap rescue for photos uploaded from an iPhone before the fix: it
 * re-encodes any stored HEIC (invisible in Chrome/Firefox) into a real
 * JPEG in place, so they show for everyone. New uploads are already
 * normalized on the way in.
 */
export default function FixPhotosButton() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async () => fixUploadedPhotos(),
    null
  );

  return (
    <div className="rounded-xl border border-heat/40 bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="tag text-heat">Rescue broken photos (HEIC → JPEG)</p>
          <p className="mt-1 max-w-2xl text-sm text-smoke">
            iPhone photos upload as HEIC, which Chrome and Firefox can&apos;t
            show. This converts every stored photo to a universal JPEG in
            place — same links, now visible on every device. New uploads are
            already fixed automatically.
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-40"
          >
            {pending ? "Fixing…" : "Fix photos now"}
          </button>
        </form>
      </div>
      {state?.error && (
        <p className="mt-3 rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">{state.error}</p>
      )}
      {state?.ok && state.note && (
        <p className="mt-3 rounded border border-volt/40 bg-volt/10 px-3 py-2 text-sm text-volt">{state.note}</p>
      )}
    </div>
  );
}
