"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type FilmScene = {
  src: string;
  poster?: string;
  eyebrow: string;
  headline: string;
  accent?: string;
  sub: string;
  ctas?: { href: string; label: string; hard?: boolean }[];
};

/**
 * Brutalist Signal — the film page as a transmission. Hard borders,
 * mono telemetry, noise over everything. Sections map the campaign:
 * floating island nav → hero (bottom-left, staggered entry) → three
 * kinetic signal cards (shuffler / typewriter / protocol) → manifesto
 * with word-by-word scroll reveal → the full asset archive as a
 * sticky stacking deck → membership CTA → system status. No animation
 * library: IntersectionObserver + CSS transitions + three tiny timers.
 */

/* ---------- shared bits ---------- */

const SHUFFLE_WORDS = ["BATTLE", "RANK", "BID", "SELL", "COLLECT", "REPEAT"];

const TELEMETRY_LINES = [
  "> vote landed · artist +2 on the board",
  "> open bid $650 · Afro Samurai Res. 1s",
  "> HX 120 ▲ +20 this week",
  "> resale executed · royalty → artist",
  "> new claim verified · provenance locked",
];

const PROTOCOL_ROWS = [
  ["01", "CREATE ACCOUNT", "/register?ref=film"],
  ["02", "VOTE A BATTLE", "/battles"],
  ["03", "BID THE BOARD", "/market"],
  ["04", "GET DRAFTED", "/drafted"],
] as const;

const MANIFESTO =
  "Commissions feed you today. Assets feed you forever. Every other platform sells artists more labor — more orders, more hours, more paint. The league is the first machine built to make the work you already did keep paying you. Battles write the rankings. Rankings move the market. The market pays the maker. That is the whole protocol.";

function useOnScreen(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setOn(true),
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, on };
}

/* ---------- C. the three signal cards ---------- */

function ShufflerCard() {
  const [i, setI] = useState(0);
  const { ref, on } = useOnScreen();
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setI((v) => (v + 1) % SHUFFLE_WORDS.length), 800);
    return () => clearInterval(t);
  }, [on]);
  return (
    <div ref={ref} className="border-2 border-white/80 bg-black p-5">
      <p className="tag text-smoke">SIG.01 · THE LOOP</p>
      <p className="display mt-6 text-5xl text-white" aria-live="off">
        {SHUFFLE_WORDS[i]}<span className="text-heat">.</span>
      </p>
      <p className="mt-6 font-mono text-xs leading-relaxed text-smoke">
        One loop, forever. The culture votes, the board moves, the work
        pays. Then it runs again.
      </p>
    </div>
  );
}

function TelemetryCard() {
  const [line, setLine] = useState(0);
  const [chars, setChars] = useState(0);
  const { ref, on } = useOnScreen();
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => {
      setChars((c) => {
        if (c < TELEMETRY_LINES[line].length) return c + 1;
        return c;
      });
    }, 28);
    return () => clearInterval(t);
  }, [on, line]);
  useEffect(() => {
    if (chars >= TELEMETRY_LINES[line].length) {
      const t = setTimeout(() => {
        setLine((l) => (l + 1) % TELEMETRY_LINES.length);
        setChars(0);
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [chars, line]);
  return (
    <div ref={ref} className="border-2 border-white/80 bg-black p-5">
      <p className="tag text-smoke">SIG.02 · LIVE TELEMETRY</p>
      <div className="mt-6 min-h-20">
        <p className="font-mono text-sm leading-relaxed text-volt">
          {TELEMETRY_LINES[line].slice(0, chars)}
          <span className="animate-pulse">█</span>
        </p>
      </div>
      <p className="mt-6 font-mono text-xs leading-relaxed text-smoke">
        Every event on the platform ticks the Heat Index. This is what
        the feed never gave you: a number that pays.
      </p>
    </div>
  );
}

function ProtocolCard() {
  const [active, setActive] = useState(0);
  const { ref, on } = useOnScreen();
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setActive((v) => (v + 1) % PROTOCOL_ROWS.length), 1200);
    return () => clearInterval(t);
  }, [on]);
  return (
    <div ref={ref} className="border-2 border-white/80 bg-black p-5">
      <p className="tag text-smoke">SIG.03 · ENTRY PROTOCOL</p>
      <div className="mt-6 space-y-1.5">
        {PROTOCOL_ROWS.map(([n, label, href], idx) => (
          <Link
            key={n}
            href={href}
            className={`flex items-baseline gap-3 font-mono text-sm transition ${
              idx === active ? "text-white" : "text-smoke/60"
            }`}
          >
            <span className="text-heat">{n}</span>
            <span>{label}</span>
            {idx === active && <span className="animate-pulse text-volt">▮</span>}
          </Link>
        ))}
      </div>
      <p className="mt-6 font-mono text-xs leading-relaxed text-smoke">
        Four moves. Free. The door is the account.
      </p>
    </div>
  );
}

/* ---------- D. manifesto reveal ---------- */

function Manifesto() {
  const { ref, on } = useOnScreen(0.25);
  const words = MANIFESTO.split(" ");
  return (
    <div ref={ref} id="creed" className="mx-auto max-w-3xl px-6 py-24">
      <p className="tag text-heat">THE CREED</p>
      <p className="display mt-6 text-3xl leading-snug text-white sm:text-4xl">
        {words.map((w, i) => (
          <span
            key={i}
            className="inline-block transition-all duration-500"
            style={{
              transitionDelay: `${i * 30}ms`,
              opacity: on ? 1 : 0.08,
              transform: on ? "translateY(0)" : "translateY(8px)",
            }}
          >
            {w}&nbsp;
          </span>
        ))}
      </p>
    </div>
  );
}

/* ---------- E. the archive: sticky stacking scenes ---------- */

function ArchiveCard({
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
  const holderRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const holder = holderRef.current;
    const video = videoRef.current;
    if (!holder || !video) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.4 }
    );
    io.observe(holder);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = !soundOn;
  }, [soundOn]);

  const parts = scene.accent ? scene.headline.split(scene.accent) : [scene.headline];

  return (
    <div ref={holderRef} className="min-h-[104svh]">
      <div
        className="sticky border-2 border-white/80 bg-black"
        style={{ top: `calc(72px + ${Math.min(index, 6) * 6}px)` }}
      >
        <div className="flex items-center justify-between border-b-2 border-white/80 px-4 py-2">
          <span className="font-mono text-xs text-smoke">
            ASSET {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
          </span>
          <span className="tag text-heat">{scene.eyebrow}</span>
        </div>
        <video
          ref={videoRef}
          src={scene.src}
          poster={scene.poster}
          muted
          loop
          playsInline
          preload="none"
          className="h-[46svh] w-full bg-black object-cover"
        />
        <div className="border-t-2 border-white/80 p-5">
          <h3 className="display text-2xl leading-tight text-white sm:text-4xl">
            {scene.accent && parts.length === 2 ? (
              <>
                {parts[0]}
                <span className="text-gradient-volt">{scene.accent}</span>
                {parts[1]}
              </>
            ) : (
              scene.headline
            )}
          </h3>
          <p className="mt-2 max-w-xl font-mono text-xs leading-relaxed text-smoke sm:text-sm">
            {scene.sub}
          </p>
          {scene.ctas && (
            <div className="mt-4 flex flex-wrap gap-2">
              {scene.ctas.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className={
                    c.hard
                      ? "btn-hard px-5 py-2.5 tag font-bold"
                      : "border-2 border-white/60 px-5 py-2.5 tag text-white transition hover:border-volt"
                  }
                >
                  {c.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- the page ---------- */

export default function FilmExperience({ scenes }: { scenes: FilmScene[] }) {
  const [soundOn, setSoundOn] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [entered, setEntered] = useState(false);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 80);
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      setScrolled(window.scrollY > 420);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const v = heroVideoRef.current;
    if (v) v.muted = !soundOn;
  }, [soundOn]);

  const jump = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const heroLines = ["DESIGNER KICKS", "GREW INTO", "A LEAGUE."];

  return (
    <div className="relative bg-black">
      {/* Noise over everything — the brutalist film grain */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[70] opacity-[0.05]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Burn bar */}
      <div className="fixed inset-x-0 top-0 z-[60] h-1 bg-white/10">
        <div className="h-full bg-heat" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* A. Floating island nav — surfaces once the hero is behind you */}
      <nav
        aria-label="Film sections"
        className={`fixed left-1/2 z-[60] flex -translate-x-1/2 gap-1 border-2 border-white/80 bg-black/90 px-1.5 py-1.5 transition-all duration-500 ${
          scrolled ? "top-16 opacity-100" : "-top-16 opacity-0"
        }`}
      >
        {[
          ["signal", "SIGNAL"],
          ["creed", "CREED"],
          ["archive", "ARCHIVE"],
          ["join", "JOIN"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => jump(id)}
            className="px-3 py-1.5 font-mono text-xs text-smoke transition hover:bg-white hover:text-black"
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Sound switch */}
      <button
        type="button"
        onClick={() => setSoundOn((s) => !s)}
        className="fixed bottom-24 right-4 z-[60] border-2 border-white/80 bg-black px-4 py-2 font-mono text-xs text-white md:bottom-6"
        aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
      >
        {soundOn ? "SND:ON" : "SND:OFF"}
      </button>

      {/* B. Hero — bottom-left, aggressive, staggered entry */}
      <section className="relative flex min-h-[100svh] items-end overflow-hidden">
        <video
          ref={heroVideoRef}
          src={scenes[0].src}
          poster={scenes[0].poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
        <div className="relative z-10 w-full px-6 pb-36 sm:px-10 md:pb-20">
          <p
            className="font-mono text-xs text-volt transition-all duration-700"
            style={{ opacity: entered ? 1 : 0, transform: entered ? "none" : "translateY(16px)" }}
          >
            SIGNAL//001 · REBRAND PROTOCOL · LIVE
          </p>
          <h1 className="mt-3">
            {heroLines.map((l, i) => (
              <span
                key={l}
                className="display block text-5xl leading-[0.95] text-white transition-all duration-700 sm:text-8xl"
                style={{
                  transitionDelay: `${150 + i * 140}ms`,
                  opacity: entered ? 1 : 0,
                  transform: entered ? "none" : "translateY(24px)",
                }}
              >
                {i === 2 ? (
                  <>
                    A <span className="text-gradient-volt">LEAGUE</span>.
                  </>
                ) : (
                  l
                )}
              </span>
            ))}
          </h1>
          <p
            className="mt-4 max-w-md font-mono text-sm leading-relaxed text-smoke transition-all duration-700"
            style={{ transitionDelay: "560ms", opacity: entered ? 1 : 0 }}
          >
            The Heat Chart: battles, rankings, and a market where
            one-of-one customs trade like assets. Scroll the transmission.
          </p>
          <div
            className="mt-6 flex flex-wrap gap-2 transition-all duration-700"
            style={{ transitionDelay: "700ms", opacity: entered ? 1 : 0 }}
          >
            <Link href="/register?ref=film" className="btn-hard px-6 py-3 tag font-bold">
              Create Free Account
            </Link>
            <button
              type="button"
              onClick={() => jump("archive")}
              className="border-2 border-white/80 px-6 py-3 tag text-white transition hover:bg-white hover:text-black"
            >
              Watch the Archive ↓
            </button>
          </div>
        </div>
      </section>

      {/* C. Signal cards */}
      <section id="signal" className="mx-auto max-w-5xl scroll-mt-28 px-6 py-24">
        <p className="tag text-heat">THE SIGNAL</p>
        <h2 className="display mt-2 text-4xl text-white sm:text-5xl">
          What the machine <span className="text-gradient-volt">does.</span>
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <ShufflerCard />
          <TelemetryCard />
          <ProtocolCard />
        </div>
      </section>

      {/* D. Manifesto */}
      <Manifesto />

      {/* E. The archive — every asset, stacking */}
      <section id="archive" className="mx-auto max-w-3xl scroll-mt-28 px-4 pb-12">
        <div className="px-2 pb-6">
          <p className="tag text-heat">THE ARCHIVE</p>
          <h2 className="display mt-2 text-4xl text-white sm:text-5xl">
            Every asset. <span className="text-gradient-volt">Stacked.</span>
          </h2>
          <p className="mt-2 font-mono text-xs text-smoke">
            {scenes.length} transmissions · scroll to stack the deck
          </p>
        </div>
        {scenes.map((s, i) => (
          <ArchiveCard key={s.src} scene={s} index={i} total={scenes.length} soundOn={soundOn} />
        ))}
      </section>

      {/* F. Membership */}
      <section id="join" className="mx-auto max-w-3xl scroll-mt-28 px-6 py-24">
        <div className="border-2 border-volt bg-black p-8 text-center">
          <p className="font-mono text-xs text-volt">MEMBERSHIP // EQUITY UPRISE</p>
          <h2 className="display mt-3 text-4xl text-white sm:text-6xl">
            Free to join. <span className="text-gradient-volt">Live now.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md font-mono text-xs leading-relaxed text-smoke sm:text-sm">
            One tier. No dues. Fans vote and bid, artists get drafted and
            earn on every resale, collectors get verified one-of-ones.
          </p>
          <div className="mx-auto mt-6 grid max-w-sm gap-2">
            <Link href="/register?ref=film" className="btn-hard block py-4 tag font-bold">
              Create Free Account
            </Link>
            <Link
              href="/market"
              className="block border-2 border-white/70 py-3.5 tag text-white transition hover:bg-white hover:text-black"
            >
              Open the Market
            </Link>
          </div>
        </div>
      </section>

      {/* G. System status */}
      <section className="border-t-2 border-white/80 px-6 py-10 pb-32 md:pb-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-3 font-mono text-xs text-smoke">
          {[
            ["LEAGUE", "LIVE"],
            ["MARKET", "OPEN"],
            ["BATTLES", "ACTIVE"],
            ["MEMBERSHIP", "FREE"],
          ].map(([k, v]) => (
            <span key={k} className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-volt" />
              {k}: <span className="text-white">{v}</span>
            </span>
          ))}
          <span className="ml-auto">SYSTEM OPERATIONAL · THE HEAT CHART</span>
        </div>
      </section>
    </div>
  );
}
