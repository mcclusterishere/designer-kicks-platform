"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { castOutfitVote } from "@/app/actions";
import { categoryEmoji } from "@/lib/categories";

type Item = { id: string; title: string; imageUrl: string; category: string };
type Side = {
  outfitId: string;
  name: string;
  byLine: string; // "The House" or the fan's name
  items: Item[];
  votes: number;
};

export default function OutfitVotePanel({
  battleId,
  a,
  b,
  active,
  isAuthed,
  yourVote,
  winnerId,
}: {
  battleId: string;
  a: Side;
  b: Side;
  active: boolean;
  isAuthed: boolean;
  yourVote: string | null;
  winnerId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [localVote, setLocalVote] = useState<string | null>(yourVote);
  const [error, setError] = useState<string | null>(null);
  const total = a.votes + b.votes + (localVote && !yourVote ? 1 : 0);
  const showResults = !active || Boolean(localVote);

  function vote(outfitId: string) {
    setError(null);
    startTransition(async () => {
      const res = await castOutfitVote(battleId, outfitId);
      if (res.ok) setLocalVote(outfitId);
      else {
        setError(res.error ?? "Something went wrong.");
        if (res.error?.includes("already voted")) setLocalVote("unknown");
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {[a, b].map((side) => {
          const sideVotes = side.votes + (localVote === side.outfitId && !yourVote ? 1 : 0);
          const pct = total === 0 ? 50 : Math.round((sideVotes / total) * 100);
          const isWinner = winnerId === side.outfitId;
          return (
            <div
              key={side.outfitId}
              className={`card-lift relative overflow-hidden rounded-xl border bg-surface ${
                isWinner ? "border-volt glow-volt" : "border-edge"
              }`}
            >
              {isWinner && (
                <div className="sticker absolute left-3 top-3 z-10 px-2 py-1 text-sm">
                  Winner
                </div>
              )}
              {/* The look, as a collage */}
              <div
                className={`grid gap-0.5 ${side.items.length >= 3 ? "grid-cols-2" : "grid-cols-" + side.items.length}`}
                data-testid="fit-collage"
              >
                {side.items.slice(0, 4).map((item) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={item.id}
                    src={item.imageUrl}
                    alt={`${item.title} — part of ${side.name}`}
                    className="aspect-square w-full object-cover"
                  />
                ))}
              </div>
              <div className="p-4">
                <h3 className="display text-xl text-white">{side.name}</h3>
                <p className="mt-0.5 text-sm text-smoke">{side.byLine}</p>
                <p className="mt-1.5 text-xs text-smoke">
                  {side.items.map((i) => `${categoryEmoji(i.category)} ${i.title}`).join(" · ")}
                </p>

                {showResults ? (
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between">
                      <span className="display text-2xl text-volt">{pct}%</span>
                      <span className="tag text-smoke">
                        {sideVotes} vote{sideVotes === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded bg-panel">
                      <div className="bar-animate h-full rounded bg-volt" style={{ width: `${pct}%` }} />
                    </div>
                    {localVote === side.outfitId && <p className="tag mt-2 text-volt">Your vote</p>}
                  </div>
                ) : isAuthed ? (
                  <button
                    onClick={() => vote(side.outfitId)}
                    disabled={pending}
                    className="mt-4 w-full rounded-lg bg-volt py-3 tag font-bold text-ink transition hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? "Counting…" : "Vote This Fit"}
                  </button>
                ) : (
                  <Link
                    href="/signin"
                    className="mt-4 block w-full rounded-lg border border-volt py-3 text-center tag font-bold text-volt transition hover:bg-volt hover:text-ink"
                  >
                    Sign In To Vote
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="mt-4 rounded border border-heat/40 bg-heat/10 px-4 py-2 text-sm text-heat">
          {error}
        </p>
      )}
    </div>
  );
}
