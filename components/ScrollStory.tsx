"use client";

import { useEffect, useRef, useState } from "react";

export type StoryFrame = {
  src: string;
  /** Short beat title shown as the frame lands. */
  title?: string;
  caption?: string;
};

/**
 * Scroll-driven photo storyline — the photo answer to scroll-scrubbed
 * video. The viewport pins while the page scrolls; each stretch of
 * scroll swaps in the next frame with a crossfade and its caption beat.
 * Works from a plain array of images, so any piece or product can get
 * a campaign story by passing frames.
 *
 * Respects prefers-reduced-motion: falls back to a simple stacked
 * gallery so nothing is trapped behind scroll-jacking.
 */
export default function ScrollStory({ frames }: { frames: StoryFrame[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = trackRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const scrollable = el.offsetHeight - window.innerHeight;
        if (scrollable <= 0) return;
        const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
        setIndex(Math.min(frames.length - 1, Math.floor(progress * frames.length)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [frames.length, reduced]);

  if (frames.length === 0) return null;

  if (reduced) {
    return (
      <div className="space-y-6">
        {frames.map((f) => (
          <figure key={f.src}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.src} alt={f.title ?? "Campaign photo"} className="w-full rounded-2xl" />
            {(f.title || f.caption) && (
              <figcaption className="mt-2 text-sm text-smoke">
                {f.title && <span className="font-bold text-white">{f.title} </span>}
                {f.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    );
  }

  const active = frames[index];

  return (
    // Tall track: one viewport of scroll per frame drives the scrub.
    <div ref={trackRef} style={{ height: `${frames.length * 100}vh` }} data-testid="scroll-story">
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden bg-ink">
        {frames.map((f, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={f.src}
            src={f.src}
            alt={i === index ? (f.title ?? "Campaign photo") : ""}
            aria-hidden={i !== index}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
            style={{ opacity: i === index ? 1 : 0 }}
          />
        ))}
        {/* Legibility wash + caption beat */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 pb-10 sm:p-10">
          {active.title && (
            <p className="display text-3xl text-white sm:text-4xl" data-testid="story-title">
              {active.title}
            </p>
          )}
          {active.caption && (
            <p className="mt-2 max-w-md text-sm text-white/80">{active.caption}</p>
          )}
          {/* Progress rail */}
          <div className="mt-5 flex gap-1.5">
            {frames.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === index ? "w-8 bg-volt" : "w-3 bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>
        <p className="tag absolute right-4 top-4 rounded-full bg-black/50 px-3 py-1.5 text-white/70">
          {index + 1} / {frames.length} · keep scrolling
        </p>
      </div>
    </div>
  );
}
