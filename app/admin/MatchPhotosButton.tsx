"use client";

import { useActionState } from "react";
import { matchArticlePhotos, type ActionResult } from "@/app/actions";

/**
 * One-tap: give every cover-less article the shoe's photo from the
 * catalog (live-API fallback for anything not yet in it). Run it after a
 * catalog import.
 */
export default function MatchPhotosButton({ missing }: { missing: number }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async () => matchArticlePhotos(),
    null
  );

  return (
    <div className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="tag text-volt">Article photos from the catalog</p>
          <p className="mt-1 text-sm text-smoke">
            Matches every article to its shoe by style code (then name) and
            borrows the catalog photo. {missing} article{missing === 1 ? "" : "s"} without a cover.
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending || missing === 0}
            className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-40"
          >
            {pending ? "Matching…" : "Match photos now"}
          </button>
        </form>
      </div>
      {state?.error && (
        <p className="mt-3 rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}
      {state?.ok && state.note && (
        <p className="mt-3 rounded border border-volt/40 bg-volt/10 px-3 py-2 text-sm text-volt">
          {state.note}
        </p>
      )}
    </div>
  );
}
