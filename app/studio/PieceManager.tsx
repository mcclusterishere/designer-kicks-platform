"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { updateMyPiece, deleteMyPiece, type ActionResult } from "@/app/actions";

const field =
  "w-full rounded-lg border border-edge bg-surface px-2.5 py-1.5 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export type MyPiece = {
  id: string;
  title: string;
  imageUrl: string;
  size: string | null;
  description: string | null;
  askingPriceCents: number | null;
  category: string;
  sold: boolean;
};

/**
 * Your closet, editable in place. Price, size and description can change
 * whenever you like without resubmitting — clearing the price simply pulls
 * the piece off the market. Pieces with a confirmed sale are locked, since
 * their price is now a record of what actually happened.
 */
export default function PieceManager({ pieces }: { pieces: MyPiece[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {pieces.length === 0 ? (
        <p className="text-sm text-smoke">
          Nothing in your closet yet —{" "}
          <Link href="/submit" className="text-volt underline">post your first piece</Link>.
        </p>
      ) : (
        pieces.map((p) => (
          <div key={p.id} className="rounded-lg border border-edge bg-panel p-2.5">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt={p.title} className="h-14 w-14 shrink-0 rounded bg-surface object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{p.title}</p>
                <p className="truncate tag text-smoke">
                  {p.askingPriceCents
                    ? `$${Math.round(p.askingPriceCents / 100).toLocaleString("en-US")} · listed`
                    : "not listed"}
                  {p.size ? ` · ${p.size}` : ""}
                  {p.sold ? " · SOLD" : ""}
                </p>
              </div>
              {p.sold ? (
                <span className="tag shrink-0 text-smoke">locked</span>
              ) : (
                <button
                  onClick={() => setOpenId(openId === p.id ? null : p.id)}
                  className="shrink-0 rounded border border-edge px-3 py-1.5 tag text-white"
                >
                  {openId === p.id ? "Close" : "Edit"}
                </button>
              )}
            </div>

            {openId === p.id && !p.sold && <EditRow piece={p} />}
          </div>
        ))
      )}
    </div>
  );
}

function EditRow({ piece }: { piece: MyPiece }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateMyPiece, null);

  return (
    <div className="mt-3 border-t border-edge/60 pt-3">
      <form action={action}>
        <input type="hidden" name="pieceId" value={piece.id} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="tag text-smoke">Asking price ($)</label>
            <input
              name="askingPrice"
              inputMode="decimal"
              defaultValue={piece.askingPriceCents ? String(Math.round(piece.askingPriceCents / 100)) : ""}
              placeholder="Blank = off the market"
              className={field}
            />
          </div>
          <div>
            <label className="tag text-smoke">Size</label>
            <input name="size" maxLength={24} defaultValue={piece.size ?? ""} placeholder="US 10.5" className={field} />
          </div>
        </div>
        <div className="mt-2">
          <label className="tag text-smoke">Description</label>
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            defaultValue={piece.description ?? ""}
            placeholder="What went into it — materials, technique, the story."
            className={field}
          />
        </div>

        {state && !state.ok && <p className="mt-2 text-sm text-heat">{state.error}</p>}
        {state?.ok && <p className="mt-2 text-sm text-volt">{state.note}</p>}

        <div className="mt-2 flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded btn-hard px-4 py-1.5 tag font-bold disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <form
        action={deleteMyPiece.bind(null, piece.id)}
        onSubmit={(e) => {
          if (!confirm(`Delete "${piece.title}"? Its votes and battle record go with it. This can't be undone.`)) {
            e.preventDefault();
          }
        }}
        className="mt-2"
      >
        <button className="rounded border border-heat px-3 py-1.5 tag text-heat hover:bg-heat/10">
          Delete this piece
        </button>
      </form>
    </div>
  );
}
