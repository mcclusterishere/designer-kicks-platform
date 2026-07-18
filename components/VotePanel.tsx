"use client";

import { useState, useTransition } from "react";
import { castVote } from "@/app/actions";
import { categoryEmoji } from "@/lib/categories";

type Side = {
  submissionId: string;
  title: string;
  artistName: string;
  artistSlug: string | null;
  socialHandle: string | null;
  baseShoe: string;
  category: string;
  imageUrl: string;
  votes: number;
};

type Props = {
  battleId: string;
  a: Side;
  b: Side;
  active: boolean;
  isAuthed: boolean;
  yourVote: string | null; // submissionId you voted for, if any
  winnerId: string | null;
};

export default function VotePanel({ battleId, a, b, active, isAuthed, yourVote, winnerId }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localVote, setLocalVote] = useState<string | null>(yourVote);

  const voted = localVote !== null;
  const showResults = voted || !active;
  const total = a.votes + b.votes;

  function vote(submissionId: string) {
    setError(null);
    startTransition(async () => {
      const res = await castVote(battleId, submissionId);
      if (res.ok) {
        setLocalVote(submissionId);
      } else {
        setError(res.error ?? "Something went wrong.");
        if (res.error?.includes("already voted")) setLocalVote("unknown");
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {[a, b].map((side, i) => {
          const pct = total === 0 ? 50 : Math.round((side.votes / total) * 100);
          const isYours = localVote === side.submissionId;
          const isWinner = winnerId === side.submissionId;
          return (
            <div
              key={side.submissionId}
              className={`relative overflow-hidden rounded-xl border bg-surface ${
                isWinner ? "border-volt glow-volt" : "border-edge"
              }`}
            >
              {isWinner && (
                <div className="absolute left-3 top-3 z-10 rounded bg-volt px-2 py-1 tag font-bold text-ink">
                  Winner
                </div>
              )}
              <div className="aspect-square w-full bg-panel">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={side.imageUrl}
                  alt={`${side.title} — custom ${side.baseShoe} by ${side.artistName}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-4">
                <p className="tag text-smoke">{categoryEmoji(side.category)} {side.baseShoe}</p>
                <h3 className="display mt-1 text-xl text-white">{side.title}</h3>
                <p className="mt-1 text-sm text-smoke">
                  by{" "}
                  {side.artistSlug ? (
                    <a
                      href={`/artists/${side.artistSlug}`}
                      className="text-white underline decoration-volt hover:text-volt"
                    >
                      {side.artistName}
                    </a>
                  ) : (
                    <span className="text-white">{side.artistName}</span>
                  )}
                  {side.socialHandle && (
                    <span className="text-volt"> @{side.socialHandle}</span>
                  )}
                </p>

                {showResults ? (
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between">
                      <span className="display text-2xl text-volt">{pct}%</span>
                      <span className="tag text-smoke">
                        {side.votes} vote{side.votes === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded bg-panel">
                      <div
                        className={`bar-animate h-full rounded ${i === 0 ? "bg-volt" : "bg-heat"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {isYours && (
                      <p className="tag mt-2 text-volt">Your vote</p>
                    )}
                  </div>
                ) : isAuthed ? (
                  <button
                    onClick={() => vote(side.submissionId)}
                    disabled={pending}
                    className="mt-4 w-full rounded-lg bg-volt py-3 tag font-bold text-ink transition hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? "Counting…" : "Vote This Piece"}
                  </button>
                ) : (
                  <a
                    href="/signin"
                    className="mt-4 block w-full rounded-lg border border-volt py-3 text-center tag font-bold text-volt transition hover:bg-volt hover:text-ink"
                  >
                    Sign In To Vote
                  </a>
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
