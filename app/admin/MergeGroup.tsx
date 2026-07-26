"use client";

import { useActionState, useState } from "react";
import { mergePiecesAction } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

type Piece = {
  id: string;
  title: string;
  status: string;
  imageUrl: string;
  photoCount: number;
  votes: number;
  createdAt: string;
  locked: string | null;
};

/**
 * One suspected duplicate set, and the choice of which listing survives.
 *
 * Defaults to keeping the piece with the most VOTES rather than the newest
 * or the one with the best photos, because votes are the only thing a
 * merge can't reconstruct. Photos move; a battle record doesn't.
 */
export default function MergeGroup({
  group,
}: {
  group: { key: string; artistId: string; artistName: string; pieces: Piece[] };
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    mergePiecesAction,
    null
  );
  const mergeable = group.pieces.filter((p) => !p.locked);
  const best = [...mergeable].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt))[0];
  const [survivor, setSurvivor] = useState(best?.id ?? "");

  if (state?.ok) {
    return (
      <div className="rounded-lg border border-volt/40 bg-volt/5 p-4 text-sm text-white">
        ✓ {state.note}
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-lg border border-edge bg-panel p-4">
      <p className="tag text-volt">{group.artistName}</p>
      <p className="mt-0.5 text-sm text-white">
        {group.pieces.length} listings that look like the same shoe
      </p>

      <div className="mt-3 space-y-2">
        {group.pieces.map((p) => (
          <label
            key={p.id}
            className={`flex items-start gap-3 rounded-lg border p-2.5 ${
              p.locked
                ? "border-edge/50 opacity-60"
                : survivor === p.id
                  ? "border-volt bg-volt/10"
                  : "border-edge"
            }`}
          >
            <input
              type="radio"
              name="survivorId"
              value={p.id}
              checked={survivor === p.id}
              disabled={Boolean(p.locked)}
              onChange={() => setSurvivor(p.id)}
              className="mt-1 h-4 w-4 shrink-0 accent-[#f04e45]"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.imageUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded border border-edge bg-surface object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-white">{p.title}</span>
              <span className="block text-xs text-smoke">
                {p.status.toLowerCase()} · {p.photoCount} photo{p.photoCount === 1 ? "" : "s"} ·{" "}
                {p.votes} vote{p.votes === 1 ? "" : "s"} · {p.createdAt.slice(0, 10)}
              </span>
              {p.locked && <span className="block text-xs text-heat">{p.locked} — left alone</span>}
            </span>
          </label>
        ))}
      </div>

      {/* Everything not chosen as survivor, and not locked, gets retired. */}
      {mergeable
        .filter((p) => p.id !== survivor)
        .map((p) => (
          <input key={p.id} type="hidden" name="duplicateId" value={p.id} />
        ))}

      {state?.error && <p className="mt-2 text-sm text-heat" role="alert">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || mergeable.length < 2}
        className="mt-3 w-full rounded-lg btn-hard py-2.5 tag font-bold disabled:opacity-50"
      >
        {pending
          ? "Merging…"
          : mergeable.length < 2
            ? "Nothing here can be merged"
            : `Keep the selected one, retire the other ${mergeable.length - 1}`}
      </button>
    </form>
  );
}
