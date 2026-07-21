"use client";

import { useEffect, useState } from "react";
import ScoreCard from "./ScoreCard";
import type { GameShoe } from "@/lib/games";

const ROUNDS = 5;
const MAX_PER_ROUND = 100;

function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const dollars = (cents: number) => Math.round(cents / 100);

/** Closeness → points: dead-on = 100, off by the price or more = 0. */
function scoreGuess(guess: number, actual: number): number {
  const off = Math.min(1, Math.abs(guess - actual) / actual);
  return Math.round(MAX_PER_ROUND * (1 - off));
}

export default function GuessResale({ pool }: { pool: GameShoe[] }) {
  const [deck, setDeck] = useState<GameShoe[]>([]);
  const [round, setRound] = useState(0);
  const [guess, setGuess] = useState("");
  const [reveal, setReveal] = useState<null | { actual: number; pts: number; offPct: number }>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  // Deal on the client so no randomness runs during SSR (no hydration drift).
  useEffect(() => {
    setDeck(shuffle(pool).slice(0, ROUNDS));
  }, [pool]);

  function reset() {
    setDeck(shuffle(pool).slice(0, ROUNDS));
    setRound(0);
    setGuess("");
    setReveal(null);
    setScore(0);
    setDone(false);
  }

  if (deck.length === 0) {
    return <div className="py-20 text-center tag text-smoke">Loading the deck…</div>;
  }

  if (done) {
    return (
      <ScoreCard
        headline="Guess The Resale"
        score={`${score}/${ROUNDS * MAX_PER_ROUND}`}
        sub={
          score >= 400
            ? "Certified price prophet. The culture can't fool you."
            : score >= 250
              ? "Solid eye. You know what moves."
              : "The market humbled you. Run it back."
        }
        shareText={`I scored ${score}/${ROUNDS * MAX_PER_ROUND} guessing sneaker resale prices on The Heat Chart 🔥 Can you beat me?`}
        gamePath="/games/guess-the-resale"
        onPlayAgain={reset}
      />
    );
  }

  const shoe = deck[round];
  const dollarValue = dollars(shoe.valueCents);

  function lockIn() {
    if (reveal) return;
    const g = Number(guess.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(g) || g <= 0) return;
    const pts = scoreGuess(g, dollarValue);
    const offPct = Math.round((Math.abs(g - dollarValue) / dollarValue) * 100);
    setReveal({ actual: dollarValue, pts, offPct });
    setScore((s) => s + pts);
  }

  function next() {
    if (round + 1 >= deck.length) {
      setDone(true);
      return;
    }
    setRound((r) => r + 1);
    setGuess("");
    setReveal(null);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="tag text-smoke">Round {round + 1} / {deck.length}</p>
        <p className="tag text-volt">{score} pts</p>
      </div>
      <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-panel">
        <div className="h-full rounded-full bg-volt transition-all duration-500" style={{ width: `${(round / deck.length) * 100}%` }} />
      </div>

      <div className="overflow-hidden rounded-3xl border border-edge bg-surface shadow-2xl">
        <div className="bg-[#f2f1ee] p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shoe.imageUrl} alt={shoe.name} className="mx-auto aspect-square w-full max-w-xs object-contain" />
        </div>
        <div className="p-5">
          {shoe.brand && <p className="tag text-smoke">{shoe.brand}</p>}
          <h2 className="display mt-0.5 text-2xl text-white">{shoe.name}</h2>
          <p className="mt-1 text-sm text-smoke">
            What does this pair {shoe.isMarket ? "resell for" : "retail for"}?
          </p>

          {!reveal ? (
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <span className="display text-2xl text-volt">$</span>
                <input
                  data-testid="guess-input"
                  type="number"
                  inputMode="numeric"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lockIn()}
                  placeholder="Your guess"
                  className="w-full rounded-lg border border-edge bg-panel px-4 py-3 text-lg text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
                />
              </div>
              <button
                onClick={lockIn}
                data-testid="lock-in"
                className="btn-hard-volt mt-3 w-full rounded-xl py-3 tag font-bold"
              >
                Lock It In
              </button>
            </div>
          ) : (
            <div className="mt-4 text-center" data-testid="guess-reveal">
              <p className="tag text-smoke">Actual {shoe.isMarket ? "resale" : "retail"}</p>
              <p className="display text-4xl text-white">${reveal.actual}</p>
              <p className="mt-1 text-sm text-smoke">
                {reveal.offPct}% off · <span className="font-bold text-volt">+{reveal.pts} pts</span>
              </p>
              <button
                onClick={next}
                data-testid="next-round"
                className="btn-hard mt-4 w-full rounded-xl py-3 tag font-bold"
              >
                {round + 1 >= deck.length ? "See My Score" : "Next Pair →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
