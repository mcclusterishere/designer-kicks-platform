"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { castVote } from "@/app/actions";
import { appHaptic } from "@/lib/haptics";
import PieceMedia from "@/components/PieceMedia";

/**
 * The mobile voting deck — hot-or-not for battles. One matchup on
 * screen, the two pieces SIDE BY SIDE, tap a side to vote, results
 * flash, the next battle slides in. Each side's photo is its own
 * swipe gallery (horizontal scroll-snap through the piece's angles),
 * so swiping to look never fights with tapping to vote.
 */

export type DeckSide = {
  submissionId: string;
  title: string;
  artistName: string;
  imageUrl: string;
  videoUrl: string | null;
  extraImages: string[];
  votes: number;
};

export type DeckBattle = {
  id: string;
  label: string;
  endsLabel: string;
  a: DeckSide;
  b: DeckSide;
};

function SidePhotos({ side }: { side: DeckSide }) {
  const [idx, setIdx] = useState(0);
  const images = [side.imageUrl, ...side.extraImages];
  // A maker's clip beats a still — play it in place of the photo carousel.
  if (side.videoUrl) {
    return (
      <div className="relative aspect-[3/4] overflow-hidden bg-panel">
        <PieceMedia
          imageUrl={side.imageUrl}
          videoUrl={side.videoUrl}
          title={side.title}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className="relative aspect-[3/4] overflow-hidden bg-panel">
      <div
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIdx(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={i === 0 ? side.title : `${side.title} — angle ${i + 1}`}
            className="h-full w-full shrink-0 snap-center object-cover"
            draggable={false}
          />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === idx ? "w-4 bg-volt" : "w-1 bg-white/50"
                }`}
              />
            ))}
          </div>
          <span className="tag pointer-events-none absolute right-1.5 top-1.5 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] text-white">
            swipe · {idx + 1}/{images.length}
          </span>
        </>
      )}
    </div>
  );
}

export default function ArenaDeck({
  battles,
  isAuthed,
}: {
  battles: DeckBattle[];
  isAuthed: boolean;
}) {
  const [i, setI] = useState(0);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [needAuth, setNeedAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const b = battles[i];
  const done = i >= battles.length;

  function advance() {
    setVotedFor(null);
    setError(null);
    setLeaving(false);
    setI((n) => n + 1);
  }

  function leaveThenAdvance(delay: number) {
    setTimeout(() => {
      setLeaving(true);
      setTimeout(advance, 300);
    }, delay);
  }

  function vote(submissionId: string) {
    if (pending || votedFor) return;
    if (!isAuthed) {
      setNeedAuth(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await castVote(b.id, submissionId);
      if (res.ok) {
        appHaptic("success");
        setVotedFor(submissionId);
        leaveThenAdvance(1600);
      } else if (res.error?.includes("already voted")) {
        setVotedFor(submissionId);
        leaveThenAdvance(900);
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  if (battles.length === 0 || done) {
    return (
      <div className="deck-in rounded-2xl border border-edge bg-surface p-8 text-center">
        <p className="tag text-heat">
          {battles.length === 0 ? "All caught up" : "Floor cleared"}
        </p>
        <p className="display mt-2 text-2xl text-white">
          {battles.length === 0
            ? "You've voted on everything live."
            : "Every live battle, voted."}
        </p>
        <p className="mt-2 text-sm text-smoke">
          New matchups drop all the time — or put your own pair on the floor.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          <Link href="/submit" className="rounded-lg btn-hard py-3 tag font-bold">
            Enter Your Customs
          </Link>
          <Link
            href="/heat-list"
            className="rounded-lg border border-edge py-3 tag font-bold text-white"
          >
            See The Standings
          </Link>
        </div>
      </div>
    );
  }

  const total = b.a.votes + b.b.votes + (votedFor ? 1 : 0);

  return (
    <div>
      {/* Progress: which fight, how long it's live */}
      <div className="flex items-center justify-between">
        <p className="tag text-smoke">
          Battle <span className="text-white">{i + 1}</span> of {battles.length}
        </p>
        <p className="tag text-heat">{b.endsLabel}</p>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded bg-panel">
        <div
          className="h-full rounded bg-volt transition-all duration-300"
          style={{ width: `${((i + (votedFor ? 1 : 0)) / battles.length) * 100}%` }}
        />
      </div>

      <div
        key={b.id}
        className={`deck-in mt-4 transition-all duration-300 ${
          leaving ? "-translate-y-5 opacity-0" : ""
        }`}
      >
        <p className="tag truncate text-center text-smoke">{b.label}</p>

        {/* The matchup: side by side, never stacked */}
        <div className="relative mt-3 grid grid-cols-2 gap-2">
          {[b.a, b.b].map((side, s) => {
            const isPick = votedFor === side.submissionId;
            const votes = side.votes + (isPick ? 1 : 0);
            const pct = total === 0 ? 50 : Math.round((votes / total) * 100);
            return (
              <div
                key={side.submissionId}
                className={`overflow-hidden rounded-2xl border bg-surface transition ${
                  isPick ? "border-volt glow-volt" : "border-edge"
                }`}
              >
                <SidePhotos side={side} />
                <div className="p-2.5">
                  <h3 className="display truncate text-base text-white">{side.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-smoke">{side.artistName}</p>
                  {votedFor ? (
                    <div className="mt-2.5">
                      <div className="flex items-baseline justify-between">
                        <span className="display text-xl text-volt">{pct}%</span>
                        <span className="tag text-[10px] text-smoke">{votes}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-panel">
                        <div
                          className={`bar-animate h-full rounded ${s === 0 ? "bg-volt" : "bg-heat"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {isPick && <p className="tag mt-1.5 text-[10px] text-volt">Your vote</p>}
                    </div>
                  ) : (
                    <button
                      onClick={() => vote(side.submissionId)}
                      disabled={pending}
                      className="mt-2.5 w-full rounded-lg btn-hard py-2.5 tag font-bold disabled:opacity-50"
                    >
                      {pending ? "…" : "Vote"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* The VS chip */}
          <span className="display pointer-events-none absolute left-1/2 top-[34%] z-10 -translate-x-1/2 rounded-full border-2 border-volt bg-ink px-2.5 py-1 text-sm text-white">
            VS
          </span>

          {/* Sign-in gate, only when a signed-out thumb tries to vote */}
          {needAuth && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-ink/85 p-6">
              <div className="text-center">
                <p className="display text-xl text-white">Make it count.</p>
                <p className="mt-1.5 text-sm text-smoke">
                  Sign in — free, 10 seconds — and your vote moves the rankings.
                </p>
                <Link
                  href="/signin?next=/battles"
                  className="mt-4 block rounded-lg btn-hard px-6 py-3 tag font-bold"
                >
                  Sign In To Vote
                </Link>
                <button
                  onClick={() => setNeedAuth(false)}
                  className="tag mt-3 text-smoke underline"
                >
                  Keep looking
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded border border-heat/40 bg-heat/10 px-3 py-2 text-center text-sm text-heat">
            {error}
          </p>
        )}

        {!votedFor && (
          <button
            onClick={() => {
              setLeaving(true);
              setTimeout(advance, 300);
            }}
            className="tag mx-auto mt-3 block text-smoke underline"
          >
            Skip this one →
          </button>
        )}
      </div>
    </div>
  );
}
