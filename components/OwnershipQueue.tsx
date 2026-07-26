"use client";

import { useActionState, useState } from "react";
import { setOwnershipAction, type ActionResult } from "@/app/actions";

export type UnansweredPiece = {
  id: string;
  title: string;
  imageUrl: string;
  size: string | null;
};

const input =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

/**
 * One piece, one question.
 *
 * The whole interaction is two taps for the common answer. Owner fields
 * appear only after "someone bought it", because a form that shows six
 * boxes to a maker who still has the shoe is a form nobody finishes —
 * and this queue only works if it's fast enough to clear in a sitting.
 */
function Row({ piece }: { piece: UnansweredPiece }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setOwnershipAction,
    null
  );
  const [sold, setSold] = useState(false);

  if (state?.ok) {
    return (
      <li className="rounded-lg border border-volt/40 bg-volt/5 p-3">
        <p className="text-sm text-volt">
          ✓ {piece.title} — logged{sold ? ". We've emailed the owner to confirm." : "."}
        </p>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-edge bg-panel p-3">
      <form action={formAction}>
        <input type="hidden" name="submissionId" value={piece.id} />
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={piece.imageUrl} alt={piece.title} className="h-14 w-14 shrink-0 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white">{piece.title}</p>
            {piece.size && <p className="text-xs text-smoke">size {piece.size}</p>}

            <div className="mt-2 flex flex-wrap gap-1.5">
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="ownershipStatus"
                  value="WITH_ARTIST"
                  className="peer sr-only"
                  defaultChecked
                  onChange={() => setSold(false)}
                />
                <span className="tag rounded-full border border-edge px-3 py-1.5 text-smoke peer-checked:border-volt peer-checked:bg-volt peer-checked:font-bold peer-checked:text-ink">
                  I still have it
                </span>
              </label>
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="ownershipStatus"
                  value="SOLD"
                  className="peer sr-only"
                  onChange={() => setSold(true)}
                />
                <span className="tag rounded-full border border-edge px-3 py-1.5 text-smoke peer-checked:border-volt peer-checked:bg-volt peer-checked:font-bold peer-checked:text-ink">
                  Someone bought it
                </span>
              </label>
            </div>
          </div>
        </div>

        {sold && (
          <div className="mt-3 space-y-2 border-t border-edge pt-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input name="ownerEmail" type="email" required placeholder="Owner's email *" className={input} />
              <input name="ownerName" placeholder="Their name" className={input} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input name="ownerPhone" placeholder="Phone (optional)" className={input} />
              <input name="ownerAddress" placeholder="Address (only if you ship)" className={input} />
            </div>
            <p className="text-[11px] text-smoke">
              We email them to confirm. Until they do, it&apos;s recorded as your word, not proof.
            </p>
          </div>
        )}

        {state && !state.ok && (
          <p role="alert" className="mt-2 rounded border border-heat/40 bg-heat/10 px-2.5 py-1.5 text-xs text-heat">
            {state.error}
          </p>
        )}

        <button
          disabled={pending}
          className="mt-3 rounded-lg btn-hard px-4 py-2 tag font-bold disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </li>
  );
}

export default function OwnershipQueue({ pieces }: { pieces: UnansweredPiece[] }) {
  if (pieces.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-volt/40 bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl text-white">Who has these?</h2>
        <p className="tag text-smoke">{pieces.length} to answer</p>
      </div>
      <p className="mt-1 text-xs text-smoke">
        These went up before we started asking. Two taps each. A piece with a confirmed owner has
        provenance, a collector page and a resale value — one without is just a photo.
      </p>
      <ul className="mt-4 space-y-2.5">
        {pieces.map((p) => (
          <Row key={p.id} piece={p} />
        ))}
      </ul>
    </section>
  );
}
