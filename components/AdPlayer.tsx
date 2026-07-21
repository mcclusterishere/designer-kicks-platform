"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type AdBeat = {
  at: number; // seconds into the video where this moment starts
  time: string; // display timestamp, e.g. "0:02"
  title: string;
  text: string;
  cta?: { href: string; label: string };
};

/**
 * The interactive ad player: the video up top, its story told beat by
 * beat underneath. Tapping a beat jumps the video to that exact
 * moment; as the video plays, the card under the playhead lights up —
 * so the words explain what the eyes are seeing, in sync. Every beat
 * ends in a "do it in the app" link, because the whole point of the
 * explainer is that a viewer can go DO the thing they just watched.
 */
export default function AdPlayer({
  src,
  poster,
  beats,
}: {
  src: string;
  poster?: string;
  beats: AdBeat[];
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);

  // Follow the playhead: whichever beat it's inside is the lit one.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onTime = () => {
      let i = 0;
      for (let b = 0; b < beats.length; b++) {
        if (v.currentTime >= beats[b].at) i = b;
      }
      setActive(i);
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [beats]);

  const seek = (i: number) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = beats[i].at;
    void v.play().catch(() => {});
    setActive(i);
  };

  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  return (
    <div>
      <div className="relative mx-auto w-full max-w-sm">
        <video
          ref={ref}
          src={src}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onClick={() => seek(0)}
          className="aspect-[9/16] w-full cursor-pointer rounded-2xl border border-edge bg-black object-cover shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        />
        {/* Controls ride the video like a story player */}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => seek(0)}
            className="glass rounded-full border border-white/20 px-3 py-1.5 tag text-white"
            aria-label="Replay from the top"
          >
            ↺ Replay
          </button>
          <button
            type="button"
            onClick={toggleSound}
            className="glass rounded-full border border-white/20 px-3 py-1.5 tag text-white"
            aria-label={muted ? "Turn sound on" : "Turn sound off"}
          >
            {muted ? "🔇 Sound" : "🔊 On"}
          </button>
        </div>
        {/* Beat progress ticks along the top edge */}
        <div className="absolute inset-x-3 top-3 flex gap-1">
          {beats.map((b, i) => (
            <button
              key={b.at}
              type="button"
              onClick={() => seek(i)}
              aria-label={`Jump to ${b.title}`}
              className={`h-1 flex-1 rounded-full transition ${
                i <= active ? "bg-volt" : "bg-white/25"
              }`}
            />
          ))}
        </div>
      </div>

      {/* The chips: tap a moment, the video jumps there */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {beats.map((b, i) => (
          <button
            key={b.at}
            type="button"
            onClick={() => seek(i)}
            className={`shrink-0 rounded-full border px-3.5 py-2 tag transition ${
              i === active
                ? "border-volt bg-volt/15 text-volt"
                : "border-edge text-smoke hover:border-volt/50 hover:text-white"
            }`}
          >
            {b.time} · {b.title}
          </button>
        ))}
      </div>

      {/* The words under the pictures — what you're watching, beat by beat */}
      <div className="mt-4 space-y-3">
        {beats.map((b, i) => (
          <div
            key={b.at}
            onClick={() => seek(i)}
            className={`cursor-pointer rounded-2xl border p-5 transition ${
              i === active
                ? "border-volt/60 bg-volt/5"
                : "border-edge bg-surface hover:border-volt/30"
            }`}
          >
            <div className="flex items-baseline gap-3">
              <span
                className={`tag tabular-nums ${i === active ? "text-volt" : "text-smoke"}`}
              >
                {b.time}
              </span>
              <h3 className="display text-lg text-white">{b.title}</h3>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-smoke">{b.text}</p>
            {b.cta && (
              <Link
                href={b.cta.href}
                onClick={(e) => e.stopPropagation()}
                className="tag mt-3 inline-block text-volt underline underline-offset-4"
              >
                {b.cta.label} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
