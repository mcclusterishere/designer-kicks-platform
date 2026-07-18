"use client";

import { useActionState, useState } from "react";
import { addSubmissionPhotos } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

/** Tops up a piece's swipe gallery — artist on their own page, or admin. */
export default function AddPhotosForm({
  submissionId,
  photoCount,
}: {
  submissionId: string;
  photoCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addSubmissionPhotos,
    null
  );

  if (state?.ok) {
    return <p className="tag mt-2 text-volt">Photos added ✓ — voters can swipe them now.</p>;
  }

  if (photoCount >= 6) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tag mt-2 rounded border border-edge px-3 py-1.5 text-smoke transition hover:border-volt hover:text-white"
      >
        + Add angles ({photoCount}/6 photos)
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input
        name="photos"
        type="file"
        multiple
        required
        accept="image/jpeg,image/png,image/webp"
        className="w-full rounded-lg border border-dashed border-edge bg-panel px-2 py-2 text-xs text-smoke file:mr-2 file:rounded file:border-0 file:bg-volt file:px-2 file:py-1 file:text-xs file:font-bold file:text-ink"
      />
      {state?.error && <p className="text-xs text-heat">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="tag w-full rounded bg-volt py-2 font-bold text-ink disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Add To Gallery"}
      </button>
    </form>
  );
}
