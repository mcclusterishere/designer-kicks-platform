"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  updateMyPiece,
  deleteMyPiece,
  updatePieceInCloset,
  type ActionResult,
} from "@/app/actions";

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
  closetHidden: boolean;
  closetSection: string | null;
  featured: boolean;
  /** YYYY-MM-DD, or "" — the shape an <input type="date"> wants. */
  commissionedAt: string;
  releasedAt: string;
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
        <>
          <p className="text-xs text-smoke">
            The order here is the order on your page. Hiding a piece takes it off your
            page but keeps its votes and its battle record — nothing is lost.
          </p>
          {pieces.map((p, i) => (
            <div
              key={p.id}
              className={`rounded-lg border bg-panel p-2.5 ${
                p.closetHidden ? "border-edge/50 opacity-60" : "border-edge"
              }`}
            >
              <div className="flex items-center gap-3">
                <ArrangeButtons id={p.id} first={i === 0} last={i === pieces.length - 1} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.title} className="h-14 w-14 shrink-0 rounded bg-surface object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-white">
                    {p.featured && <span className="mr-1 text-heat" title="Your lead piece">★</span>}
                    {p.title}
                  </p>
                  <p className="truncate tag text-smoke">
                    {p.askingPriceCents
                      ? `$${Math.round(p.askingPriceCents / 100).toLocaleString("en-US")} · listed`
                      : "not listed"}
                    {p.size ? ` · ${p.size}` : ""}
                    {p.closetSection ? ` · ${p.closetSection}` : ""}
                    {p.closetHidden ? " · hidden" : ""}
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
          ))}
        </>
      )}
    </div>
  );
}

/** Move a piece up or down the wall. */
function ArrangeButtons({ id, first, last }: { id: string; first: boolean; last: boolean }) {
  const [, action, pending] = useActionState<ActionResult | null, FormData>(updatePieceInCloset, null);
  const btn =
    "flex h-5 w-6 items-center justify-center rounded border border-edge text-[10px] text-smoke hover:text-white disabled:opacity-30";
  return (
    <form action={action} className="flex shrink-0 flex-col gap-0.5">
      <input type="hidden" name="pieceId" value={id} />
      <button name="move" value="up" disabled={first || pending} className={btn} aria-label="Move up">▲</button>
      <button name="move" value="down" disabled={last || pending} className={btn} aria-label="Move down">▼</button>
    </form>
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
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="tag text-smoke">Commissioned on</label>
            <input
              name="commissionedAt"
              type="date"
              defaultValue={piece.commissionedAt ?? ""}
              className={field}
            />
          </div>
          <div>
            <label className="tag text-smoke">Released on</label>
            <input
              name="releasedAt"
              type="date"
              defaultValue={piece.releasedAt ?? ""}
              className={field}
            />
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

      <ClosetControls piece={piece} />

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

/**
 * Closet placement for one piece: what section it files under, and whether
 * it hangs at all. Kept separate from the price/size form above so saving
 * a description never silently changes where the piece lives.
 */
function ClosetControls({ piece }: { piece: MyPiece }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updatePieceInCloset,
    null
  );

  return (
    <form action={action} className="mt-3 border-t border-edge/60 pt-3">
      <input type="hidden" name="pieceId" value={piece.id} />
      <label className="tag text-smoke" htmlFor={`sec-${piece.id}`}>
        Section on your page
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <input
          id={`sec-${piece.id}`}
          name="section"
          maxLength={40}
          defaultValue={piece.closetSection ?? ""}
          placeholder="2026 work · Commissions · Grails"
          className={field}
        />
        <div className="flex gap-2">
          <button
            name="move"
            value="section"
            disabled={pending}
            className="shrink-0 rounded border border-edge px-3 py-1.5 tag text-white disabled:opacity-50"
          >
            Save section
          </button>
          <button
            name="move"
            value="hide"
            disabled={pending}
            className="shrink-0 rounded border border-edge px-3 py-1.5 tag text-smoke hover:text-white disabled:opacity-50"
          >
            {piece.closetHidden ? "Show on my page" : "Hide from my page"}
          </button>
        </div>
      </div>
      {state && !state.ok && <p className="mt-2 text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-volt">{state.note}</p>}
    </form>
  );
}
