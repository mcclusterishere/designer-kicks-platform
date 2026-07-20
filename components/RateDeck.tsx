"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { rateDesign, rateCatalogShoe } from "@/app/actions";
import SwipeGallery from "@/components/SwipeGallery";

export type RateCard = {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string | null;
  images: string[]; // cover first, then every extra angle — swipeable
  chips: string[];
  // Retail cards are REAL shoes from the catalog — they rate through
  // their own table and wear a market-value plate. Customs omit these.
  kind?: "custom" | "retail";
  value?: string | null;
};

// The Rate game deck — one design at a time, scored out of five
// flames. Feels like an app: stacked cards, one-thumb controls, the
// community verdict revealed the moment you commit.
export default function RateDeck({ cards, ratedBefore }: { cards: RateCard[]; ratedBefore: number }) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [reveal, setReveal] = useState<{ stars: number; avg: number; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const card = cards[index];
  const done = !card;

  function advance() {
    setLeaving(true);
    window.setTimeout(() => {
      setReveal(null);
      setLeaving(false);
      setIndex((i) => i + 1);
    }, 420);
  }

  function rate(stars: number) {
    if (!card || pending || reveal || leaving) return;
    setError(null);
    startTransition(async () => {
      const res = card.kind === "retail" ? await rateCatalogShoe(card.id, stars) : await rateDesign(card.id, stars);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      setReveal({ stars, avg: res.avg ?? stars, count: res.count ?? 1 });
      window.setTimeout(advance, 1200);
    });
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-volt/40 bg-surface/80 p-8 text-center shadow-2xl">
        <p className="display text-4xl text-volt">Done</p>
        <h2 className="display mt-3 text-3xl text-white">Deck Cleared</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-smoke">
          You&apos;ve rated {ratedBefore + index} design{ratedBefore + index === 1 ? "" : "s"}. Every
          score sharpens your taste profile — and decides what the chart
          calls heat.
        </p>
        <div className="mt-6 grid gap-2">
          <Link href="/profile#taste" className="btn-hard block rounded-xl py-3 tag font-bold">
            See Your Taste Profile
          </Link>
          <Link
            href="/battles"
            className="btn-hard-volt block rounded-xl py-3 tag font-bold"
          >
            Back To The Arena
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Progress */}
      <div className="mb-3 flex items-center justify-between">
        <p className="tag text-smoke">
          {index + 1} / {cards.length}
        </p>
        <p className="tag text-volt">Rate the heat</p>
      </div>
      <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-panel">
        <div
          className="h-full rounded-full bg-volt transition-all duration-500"
          style={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      {/* The stack */}
      <div className="relative">
        {cards
          .slice(index + 1, index + 3)
          .reverse()
          .map((c, i, arr) => {
            const depth = arr.length - i; // 1 = directly behind
            return (
              <div
                key={c.id}
                aria-hidden
                className="absolute inset-0 overflow-hidden rounded-3xl border border-edge bg-panel"
                style={{
                  transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.035})`,
                  opacity: 1 - depth * 0.25,
                }}
              />
            );
          })}

        <div
          data-testid="rate-card"
          className={`relative overflow-hidden rounded-3xl border border-edge bg-surface shadow-2xl ${
            leaving ? "rate-card-exit" : "rate-card-enter"
          }`}
        >
          {/* keyed per card so the gallery rewinds to photo 1 on deal */}
          <SwipeGallery
            key={card.id}
            testId="rate-gallery"
            images={card.images}
            alt={`${card.title} by ${card.artistName}`}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />

          <div className="p-4">
            <h2 className="display text-2xl text-white">{card.title}</h2>
            <p className="mt-0.5 text-sm text-smoke">
              by{" "}
              {card.artistSlug ? (
                <Link href={`/artists/${card.artistSlug}`} className="text-volt underline">
                  {card.artistName}
                </Link>
              ) : (
                card.artistName
              )}
            </p>
            {card.value && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-volt/50 bg-volt/10 px-3 py-1.5">
                <span className="tag font-bold text-volt">{card.value}</span>
              </div>
            )}
            {card.chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {card.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-edge bg-panel px-2.5 py-1 text-xs text-smoke"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}

            {/* Flames */}
            <div className="mt-4 flex justify-between gap-1.5" role="group" aria-label="Rate this design out of 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => rate(n)}
                  disabled={pending || leaving || Boolean(reveal)}
                  aria-label={`${n} flame${n === 1 ? "" : "s"}`}
                  className={`flame-btn flex-1 rounded-xl border py-3 text-xl transition ${
                    reveal && reveal.stars >= n
                      ? "border-volt bg-volt/15"
                      : "border-edge bg-panel hover:border-volt"
                  } disabled:opacity-80`}
                >
                  <span className={reveal && reveal.stars < n ? "opacity-25" : undefined}>🔥</span>
                  <span className="mt-0.5 block text-[10px] text-smoke">{n}</span>
                </button>
              ))}
            </div>

            {reveal ? (
              <p className="mt-3 text-center text-sm text-volt" data-testid="rate-reveal">
                You said {reveal.stars} · the culture says{" "}
                <span className="display text-lg">{reveal.avg}</span> ({reveal.count} rating
                {reveal.count === 1 ? "" : "s"})
              </p>
            ) : (
              <button
                onClick={advance}
                disabled={pending || leaving}
                className="mt-3 w-full text-center tag text-smoke hover:text-white"
              >
                Pass — show me another
              </button>
            )}
            {error && <p className="mt-2 text-center text-sm text-heat">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
