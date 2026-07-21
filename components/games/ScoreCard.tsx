"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * The shareable payoff. Built to get screenshotted and posted to
 * Facebook: Web Share on phones, a Facebook share-dialog fallback on
 * desktop, and a copy-link that both feed the viral loop back to the game.
 */
export default function ScoreCard({
  headline,
  score,
  sub,
  shareText,
  gamePath,
  onPlayAgain,
}: {
  headline: string;
  score: string;
  sub: string;
  shareText: string;
  gamePath: string;
  onPlayAgain: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const gameUrl = () =>
    (typeof window !== "undefined" ? window.location.origin : "https://theheatchart.com") + gamePath;

  async function share() {
    const url = gameUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "The Heat Chart", text: shareText, url });
        return;
      } catch {
        /* user dismissed — fall through to the FB dialog */
      }
    }
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=500"
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${shareText} ${gameUrl()}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div
      data-testid="score-card"
      className="rounded-3xl border border-volt/40 bg-surface/90 p-8 text-center shadow-2xl"
    >
      <p className="tag text-heat">{headline}</p>
      <p className="display mt-2 text-6xl text-gradient-volt">{score}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm text-smoke">{sub}</p>

      <div className="mt-6 grid gap-2">
        <button
          onClick={share}
          className="btn-hard-volt block w-full rounded-xl py-3 tag font-bold"
        >
          Share My Score 🔥
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onPlayAgain} className="btn-hard rounded-xl py-3 tag font-bold">
            Play Again
          </button>
          <button
            onClick={copy}
            className="rounded-xl border border-edge py-3 tag font-bold text-smoke transition hover:border-volt hover:text-white"
          >
            {copied ? "Copied ✓" : "Copy Link"}
          </button>
        </div>
        <Link href="/games" className="mt-1 tag text-smoke transition hover:text-white">
          ← Back to the arcade
        </Link>
      </div>
    </div>
  );
}
