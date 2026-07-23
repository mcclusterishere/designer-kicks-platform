"use client";

import { useState } from "react";
import { deleteSubmissionCascade } from "@/app/actions";

type Piece = {
  id: string;
  title: string;
  artistName: string;
  imageUrl: string;
  category: string;
  votes: number;
  broken: boolean;
};

/**
 * Searchable list of live (approved) pieces with a per-piece delete. Lets
 * an admin find a specific entry — e.g. a pictureless junk piece — and
 * remove it without touching the good ones. Broken-image pieces (photo
 * lost before the storage fix) are flagged and can be filtered on.
 */
export default function PieceManager({ pieces }: { pieces: Piece[] }) {
  const [q, setQ] = useState("");
  const [onlyBroken, setOnlyBroken] = useState(false);
  const needle = q.trim().toLowerCase();
  const brokenCount = pieces.filter((p) => p.broken).length;

  const shown = pieces.filter((p) => {
    if (onlyBroken && !p.broken) return false;
    if (!needle) return true;
    return (
      p.title.toLowerCase().includes(needle) ||
      p.artistName.toLowerCase().includes(needle)
    );
  });

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title or artist…"
          className="min-w-[200px] flex-1 rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setOnlyBroken((v) => !v)}
          className={`rounded-lg border px-3 py-2 tag ${onlyBroken ? "border-heat text-heat" : "border-edge text-smoke"}`}
        >
          No-image only{brokenCount ? ` (${brokenCount})` : ""}
        </button>
      </div>

      <p className="mt-2 text-xs text-smoke">
        Showing {shown.length} of {pieces.length}. Deleting a piece removes it
        from the Heat List, battles and the market — permanently.
      </p>

      <div className="mt-3 space-y-2">
        {shown.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-edge bg-panel p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.imageUrl}
              alt={p.title}
              className="h-14 w-14 shrink-0 rounded bg-surface object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-white">
                {p.title}
                {p.broken && <span className="tag ml-2 text-heat">no image</span>}
              </p>
              <p className="truncate text-xs text-smoke">
                {p.artistName} · {p.category} · {p.votes} vote{p.votes === 1 ? "" : "s"}
              </p>
            </div>
            <form
              action={deleteSubmissionCascade.bind(null, p.id)}
              onSubmit={(e) => {
                if (!confirm(`Delete "${p.title}" by ${p.artistName}? This can't be undone.`)) {
                  e.preventDefault();
                }
              }}
            >
              <button className="rounded border border-heat px-3 py-1.5 tag text-heat hover:bg-heat/10">
                Delete
              </button>
            </form>
          </div>
        ))}
        {shown.length === 0 && <p className="text-sm text-smoke">No pieces match.</p>}
      </div>
    </div>
  );
}
