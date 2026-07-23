"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { rateDesign, rateCatalogShoe, moreRateCards } from "@/app/actions";
import SwipeGallery from "@/components/SwipeGallery";
import PieceMedia from "@/components/PieceMedia";
import LocalMoney from "@/components/LocalMoney";

export type RateCard = {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string | null;
  images: string[]; // cover first, then every extra angle — swipeable
  videoUrl?: string | null; // a maker's clip plays in place of the photos
  chips: string[];
  // Retail cards are REAL shoes from the catalog — they rate through
  // their own table and wear a market-value plate. Customs omit these.
  kind?: "custom" | "retail";
  value?: string | null;
  usdValue?: number | null;
};

// The Rate game deck — one design at a time, scored out of five
// flames. Feels like an app: stacked cards, one-thumb controls, the
// community verdict revealed the moment you commit.
export default function RateDeck({ cards, ratedBefore }: { cards: RateCard[]; ratedBefore: number }) {
  const [deck, setDeck] = useState(cards);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [reveal, setReveal] = useState<{ stars: number; avg: number; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Endless mode: when the hand runs low, deal another behind the
  // scenes. `exhausted` flips only when a re-deal comes back empty.
  const [exhausted, setExhausted] = useState(false);
  const dealing = useRef(false);
  const seen = useRef<string[]>([]);

  useEffect(() => {
    if (exhausted || dealing.current) return;
    if (deck.length - index > 3) return;
    dealing.current = true;
    const exclude = [...seen.current, ...deck.map((c) => c.id)];
    moreRateCards(exclude)
      .then((res) => {
        if (!res.ok) return;
        setDeck((d) => {
          const ids = new Set(d.map((c) => c.id));
          const fresh = res.cards.filter((c) => !ids.has(c.id) && !seen.current.includes(c.id));
          if (fresh.length === 0) setExhausted(true);
          return [...d, ...fresh];
        });
      })
      .finally(() => {
        dealing.current = false;
      });
  }, [index, deck, exhausted]);

  const card = deck[index];
  const done = !card;

  function advance() {
    if (card) seen.current.push(card.id);
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
        <p className="display text-4xl text-volt">Cleared</p>
        <h2 className="display mt-3 text-3xl text-white">You Rated Everything Live</h2>
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
      {/* Running count — the deck never runs out, so no fake finish line */}
      <div className="mb-4 flex items-center justify-between">
        <p className="tag text-smoke">
          <span className="text-white">{ratedBefore + index}</span> rated
        </p>
        <p className="tag text-volt">∞ endless deck</p>
      </div>

      {/* The stack */}
      <div className="relative">
        {deck
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
          {card.videoUrl ? (
            <PieceMedia
              key={card.id}
              imageUrl={card.images[0]}
              videoUrl={card.videoUrl}
              title={`${card.title} by ${card.artistName}`}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <SwipeGallery
              key={card.id}
              testId="rate-gallery"
              images={card.images}
              alt={`${card.title} by ${card.artistName}`}
              fit={card.kind === "retail" ? "contain" : "cover"}
            />
          )}
          {card.kind !== "retail" && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
          )}

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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-lg border border-volt/50 bg-volt/10 px-3 py-1.5 tag font-bold text-volt">{card.value}</span>
                {card.usdValue ? <LocalMoney usd={card.usdValue} /> : null}
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
                className="mt-3 w-full rounded-xl border-2 border-volt/60 bg-panel py-3 tag font-bold text-volt transition hover:border-volt hover:bg-volt/10 disabled:opacity-50"
              >
                Show Me Another →
              </button>
            )}
            {error && <p className="mt-2 text-center text-sm text-heat">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
