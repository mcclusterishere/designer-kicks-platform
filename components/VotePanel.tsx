"use client";

import { useState, useTransition } from "react";
import { castVote } from "@/app/actions";
import { appHaptic } from "@/lib/haptics";
import { categoryLabel } from "@/lib/categories";
import SwipeGallery from "@/components/SwipeGallery";

type Side = {
  submissionId: string;
  title: string;
  artistName: string;
  artistSlug: string | null;
  socialHandle: string | null;
  baseShoe: string;
  category: string;
  imageUrl: string;
  extraImages: string[];
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
        appHaptic("success");
        setLocalVote(submissionId);
      } else {
        setError(res.error ?? "Something went wrong.");
        if (res.error?.includes("already voted")) setLocalVote("unknown");
      }
    });
  }

  return (
    <div>
      {/* Side by side on every screen — a matchup reads left vs right,
          never one under the other. */}
      <div className="grid grid-cols-2 gap-2 md:gap-6">
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
                <div className="absolute left-3 top-3 z-10 rounded btn-hard px-2 py-1 tag font-bold">
                  Winner
                </div>
              )}
              <SwipeGallery
                testId="vote-gallery"
                images={[side.imageUrl, ...side.extraImages]}
                alt={`${side.title} — custom ${side.baseShoe} by ${side.artistName}`}
              />
              <div className="p-2.5 sm:p-4">
                <p className="tag hidden text-smoke sm:block">{categoryLabel(side.category)} · {side.baseShoe}</p>
                <h3 className="display mt-1 break-words text-base leading-tight text-white sm:text-xl">{side.title}</h3>
                <p className="mt-1 text-xs text-smoke sm:text-sm">
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
                    className="mt-3 w-full rounded-lg btn-hard py-3 tag font-bold transition hover:opacity-90 disabled:opacity-50 sm:mt-4"
                  >
                    {pending ? "Counting…" : "Vote"}
                  </button>
                ) : (
                  <a
                    href="/signin"
                    className="mt-3 block w-full rounded-lg border border-volt py-3 text-center tag font-bold text-volt transition hover:btn-hard hover:text-ink sm:mt-4"
                  >
                    Sign In
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded border border-heat/40 bg-heat/10 px-4 py-2 text-sm text-heat">
          {error}
        </p>
      )}
    </div>
  );
}
