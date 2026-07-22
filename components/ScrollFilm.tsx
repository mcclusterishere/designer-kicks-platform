"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type FilmScene = {
  src: string;
  poster?: string;
  eyebrow: string;
  headline: string;
  accent?: string; // the phrase inside headline that gets the heat treatment
  sub: string;
  ctas?: { href: string; label: string; hard?: boolean }[];
};

/**
 * The scroll film — one long ad. Every scene is a full-screen shot:
 * the video plays only while it's on screen (and pauses the moment it
 * leaves, so eleven videos never fight each other), the copy rises in
 * as the scene arrives, and a progress bar burns across the top like
 * a story. One sound toggle rules all scenes.
 */

function Scene({
  scene,
  index,
  total,
  soundOn,
}: {
  scene: FilmScene;
  index: number;
  total: number;
  soundOn: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  // Play only the scene on screen; everything else stays paused.
  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(section);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = !soundOn;
  }, [soundOn]);

  const parts = scene.accent ? scene.headline.split(scene.accent) : [scene.headline];

  return (
    <section ref={sectionRef} className="relative min-h-[100svh] overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={scene.src}
        poster={scene.poster}
        muted
        loop
        playsInline
        preload="none"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Legibility vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/50" />

      {/* Scene marker */}
      <p className="absolute right-4 top-4 z-10 tag tabular-nums text-white/60">
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>

      {/* The words, rising in with the scene */}
      <div
        className={`absolute inset-x-0 bottom-0 z-10 mx-auto max-w-2xl px-6 pb-28 text-center transition-all duration-700 md:pb-20 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        <p className="tag text-volt">{scene.eyebrow}</p>
        <h2 className="display mt-2 text-4xl leading-tight text-white sm:text-6xl">
          {scene.accent && parts.length === 2 ? (
            <>
              {parts[0]}
              <span className="text-gradient-volt">{scene.accent}</span>
              {parts[1]}
            </>
          ) : (
            scene.headline
          )}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-smoke sm:text-lg">
          {scene.sub}
        </p>
        {scene.ctas && (
          <div className="mx-auto mt-5 grid max-w-xs gap-2">
            {scene.ctas.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className={
                  c.hard
                    ? "btn-hard block rounded-xl py-3.5 tag font-bold"
                    : "glass block rounded-xl border border-white/25 py-3.5 tag text-white transition hover:border-volt"
                }
              >
                {c.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function ScrollFilm({ scenes }: { scenes: FilmScene[] }) {
  const [soundOn, setSoundOn] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="bg-black">
      {/* The burn bar */}
      <div className="fixed inset-x-0 top-0 z-[60] h-1 bg-white/10">
        <div
          className="h-full bg-heat transition-[width] duration-150"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* One sound switch for the whole film */}
      <button
        type="button"
        onClick={() => setSoundOn((s) => !s)}
        className="glass fixed bottom-24 right-4 z-[60] rounded-full border border-white/25 px-4 py-2.5 tag text-white md:bottom-6"
        aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
      >
        {soundOn ? "🔊 Sound on" : "🔇 Sound"}
      </button>

      {scenes.map((s, i) => (
        <Scene key={s.src} scene={s} index={i} total={scenes.length} soundOn={soundOn} />
      ))}
    </div>
  );
}
