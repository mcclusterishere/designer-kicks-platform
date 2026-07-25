"use client";

import { useState, useTransition } from "react";
import { castVote } from "@/app/actions";
import { appHaptic } from "@/lib/haptics";
import { categoryLabel } from "@/lib/categories";
import SwipeGallery from "@/components/SwipeGallery";
import PieceMedia from "@/components/PieceMedia";

type Side = {
  submissionId: string;
  title: string;
  artistName: string;
  artistSlug: string | null;
  socialHandle: string | null;
  baseShoe: string;
  category: string;
  imageUrl: string;
  videoUrl: string | null;
  extraImages: string[];
  votes: number;
};

type Props = {
  battleId: string;
  a: Side;
  b: Side;
  active: boolean;
  isAuthed: boolean;
  /** Anonymous tallies — shown, but never part of the ranked split. */
  guestVotes?: { a: number; b: number };
  yourVote: string | null; // submissionId you voted for, if any
  winnerId: string | null;
};

export default function VotePanel({ battleId, a, b, active, isAuthed, yourVote, winnerId, guestVotes }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localVote, setLocalVote] = useState<string | null>(yourVote);
  // Which side you actually pressed, so only that button says "Counting…"
  // instead of both going busy on one tap.
  const [pressed, setPressed] = useState<string | null>(null);

  const voted = localVote !== null;
  const showResults = voted || !active;

  /**
   * Count your own vote the moment it lands.
   *
   * The vote counts arrive as props from the server. Flipping to the
   * results view the instant the action returns — but before the server
   * re-render catches up — meant reading the pre-vote numbers, so a first
   * vote on a fresh battle showed "50% · 0 votes" on both sides and then
   * snapped to 100/0 when the refresh arrived. That flash is the bug.
   *
   * `yourVote` is the signal for whether the server has counted you yet:
   * while it's still null and we know we voted, add our own vote in. Once
   * the refresh lands, `yourVote` is set, the bump switches off, and the
   * prop already includes it — so it's never counted twice, and the number
   * stays right even if the refresh never arrives at all.
   */
  const counted = yourVote !== null;
  const bump = (id: string) => (!counted && localVote === id ? 1 : 0);
  const aVotes = a.votes + bump(a.submissionId);
  const bVotes = b.votes + bump(b.submissionId);
  const total = aVotes + bVotes;
  const myVote = yourVote ?? localVote;
  const guestTotal = (guestVotes?.a ?? 0) + (guestVotes?.b ?? 0);

  function vote(submissionId: string) {
    setError(null);
    setPressed(submissionId);
    startTransition(async () => {
      const res = await castVote(battleId, submissionId);
      if (res.ok) {
        appHaptic("success");
        setLocalVote(submissionId);
      } else {
        setError(res.error ?? "Something went wrong.");
        // Already voted from another tab or device: show the standings, but
        // don't claim a side we can't identify — and don't add a phantom
        // vote to the count.
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
          const sideVotes = i === 0 ? aVotes : bVotes;
          const pct = total === 0 ? 50 : Math.round((sideVotes / total) * 100);
          const isYours = myVote === side.submissionId;
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
              {side.videoUrl ? (
                <PieceMedia
                  imageUrl={side.imageUrl}
                  videoUrl={side.videoUrl}
                  title={`${side.title} — custom ${side.baseShoe} by ${side.artistName}`}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <SwipeGallery
                  testId="vote-gallery"
                  images={[side.imageUrl, ...side.extraImages]}
                  alt={`${side.title} — custom ${side.baseShoe} by ${side.artistName}`}
                />
              )}
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
                        {sideVotes} vote{sideVotes === 1 ? "" : "s"}
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
                ) : (
                  <button
                    onClick={() => vote(side.submissionId)}
                    disabled={pending}
                    className="mt-3 w-full rounded-lg btn-hard py-3 tag font-bold transition hover:opacity-90 disabled:opacity-50 sm:mt-4"
                  >
                    {pending && pressed === side.submissionId ? "Counting…" : "Vote"}
                  </button>
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

      {/* Two numbers, stated separately rather than blended. The bars are the
          ranked result; anonymous votes are real and counted, they just don't
          move an artist's standing, and saying so is the only way the Heat
          List stays defensible when somebody asks how they lost. */}
      {showResults && guestTotal > 0 && (
        <p className="mt-3 tag text-smoke">
          {guestTotal} anonymous vote{guestTotal === 1 ? "" : "s"} also cast
          {guestVotes ? ` (${guestVotes.a}–${guestVotes.b})` : ""} · bars show
          signed-in votes, which are the ones that count toward the Heat List
        </p>
      )}

      {showResults && !isAuthed && (
        <p className="mt-2 tag text-volt">
          Your vote counted.{" "}
          <a href="/signin" className="underline">Sign in</a> and it starts
          counting toward the Heat List and the Draft too.
        </p>
      )}
    </div>
  );
}
