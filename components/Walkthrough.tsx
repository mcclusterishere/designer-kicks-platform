"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "hc-tour-done";

// The once-ever welcome. Four beats, one button, gone forever after
// dismissal (or quietly never shown again once seen). Deliberately an
// inline card, not a modal — nothing to trap or block.
export default function Walkthrough() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {}
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  }

  if (!show) return null;
  return (
    <div className="mt-6 rounded-2xl border border-volt/40 bg-surface p-5" data-testid="walkthrough">
      <p className="display text-xl text-white">Welcome to the league.</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          { n: "01", title: "The Feed", body: "Rate customs, answer culture questions, build your Culture IQ.", href: "/" },
          { n: "02", title: "The Arena", body: "Vote head-to-head battles. Your vote crowns champions.", href: "/battles" },
          { n: "03", title: "Drops", body: "Every release date, story, and raffle link — free forever.", href: "/drops" },
          { n: "04", title: "Heat Check", body: "The quiz gauntlet. Survive it for giveaway entries.", href: "/quiz" },
        ].map((s) => (
          <Link
            key={s.n}
            href={s.href}
            className="rounded-xl border border-edge bg-panel p-3 transition hover:border-volt/60"
          >
            <p className="tag text-volt">{s.n} · {s.title}</p>
            <p className="mt-1 text-sm text-smoke">{s.body}</p>
          </Link>
        ))}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="btn-hard mt-4 w-full rounded-xl py-3 tag font-bold"
      >
        Got it — I&apos;m in
      </button>
    </div>
  );
}
