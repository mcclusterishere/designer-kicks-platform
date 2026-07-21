"use client";

import { useEffect, useState } from "react";
import ScoreCard from "./ScoreCard";
import type { GameShoe } from "@/lib/games";

function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const dollars = (cents: number) => Math.round(cents / 100);

/**
 * Classic Higher/Lower, sneaker-resale edition. The left shoe's value is
 * shown; guess whether the challenger on the right resells higher or
 * lower. Right → the challenger becomes the anchor and a new one slides
 * in; wrong → game over. Ties always pass (generous). Endless: the queue
 * reshuffles the pool back on when it runs low.
 */
export default function HigherLower({ pool }: { pool: GameShoe[] }) {
  const [queue, setQueue] = useState<GameShoe[]>([]);
  const [i, setI] = useState(0);
  const [streak, setStreak] = useState(0);
  const [reveal, setReveal] = useState<null | { correct: boolean }>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    setQueue(shuffle(pool));
    setI(0);
    setStreak(0);
    setReveal(null);
    setOver(false);
  }, [pool]);

  function reset() {
    setQueue(shuffle(pool));
    setI(0);
    setStreak(0);
    setReveal(null);
    setOver(false);
  }

  if (queue.length < 2) {
    return <div className="py-20 text-center tag text-smoke">Loading the deck…</div>;
  }

  const current = queue[i];
  const next = queue[i + 1];

  if (over) {
    return (
      <ScoreCard
        headline="Higher Or Lower"
        score={`${streak}`}
        sub={
          streak >= 12
            ? "Elite. You've got the whole market memorized."
            : streak >= 6
              ? "Strong run. The chart respects it."
              : "The market got you. Run it back."
        }
        shareText={`I hit a streak of ${streak} on Higher or Lower — sneaker resale edition — at The Heat Chart 🔥 Beat it.`}
        gamePath="/games/higher-or-lower"
        onPlayAgain={reset}
      />
    );
  }

  function pick(higher: boolean) {
    if (reveal || !next) return;
    const correct = higher
      ? next.valueCents >= current.valueCents
      : next.valueCents <= current.valueCents;
    setReveal({ correct });
    window.setTimeout(() => {
      if (!correct) {
        setOver(true);
        return;
      }
      setStreak((s) => s + 1);
      setI((x) => {
        const nx = x + 1;
        // Top the queue back up before we run out, so it never ends on its own.
        if (nx + 2 >= queue.length) setQueue((q) => [...q, ...shuffle(pool)]);
        return nx;
      });
      setReveal(null);
    }, 1300);
  }

  const Card = ({ shoe, showValue }: { shoe: GameShoe; showValue: boolean }) => (
    <div className="flex-1 overflow-hidden rounded-2xl border border-edge bg-surface">
      <div className="bg-[#f2f1ee] p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shoe.imageUrl} alt={shoe.name} className="aspect-square w-full object-contain" />
      </div>
      <div className="p-3 text-center">
        {shoe.brand && <p className="tag text-smoke">{shoe.brand}</p>}
        <p className="line-clamp-2 text-sm font-bold text-white">{shoe.name}</p>
        {showValue ? (
          <p className="display mt-1 text-2xl text-volt">${dollars(shoe.valueCents)}</p>
        ) : (
          <p className="display mt-1 text-2xl text-smoke">$&nbsp;?</p>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 text-center">
        <p className="tag text-smoke">Current streak</p>
        <p className="display text-4xl text-gradient-volt" data-testid="hl-streak">{streak}</p>
      </div>

      <div className="flex items-stretch gap-3">
        <Card shoe={current} showValue />
        <Card shoe={next} showValue={reveal !== null} />
      </div>

      {reveal ? (
        <p
          data-testid="hl-reveal"
          className={`mt-4 text-center display text-2xl ${reveal.correct ? "text-volt" : "text-heat"}`}
        >
          {reveal.correct ? "Correct 🔥" : "Wrong — that's the game"}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => pick(true)}
            data-testid="pick-higher"
            className="btn-hard-volt rounded-xl py-4 tag font-bold"
          >
            ▲ Higher
          </button>
          <button
            onClick={() => pick(false)}
            data-testid="pick-lower"
            className="btn-hard rounded-xl py-4 tag font-bold"
          >
            ▼ Lower
          </button>
        </div>
      )}
      <p className="mt-3 text-center text-xs text-smoke/70">
        Does the <span className="text-white">right</span> pair resell higher or lower than the left?
      </p>
    </div>
  );
}
