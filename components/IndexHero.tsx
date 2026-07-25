"use client";

import { useEffect, useRef, useState } from "react";

type Point = { at: string; value: number };

/**
 * The floor's hero: a live index that counts up on mount and an area chart
 * drawn from REAL recorded snapshots. No modelled curve — with fewer than
 * two observations it says the history is still building rather than
 * inventing a shape. Everything animates in CSS/SVG, nothing polls.
 */
export default function IndexHero({
  value,
  history,
  listed,
  quoted,
  advancers,
  decliners,
}: {
  value: number | null;
  history: Point[];
  listed: number;
  quoted: number;
  advancers: number;
  decliners: number;
}) {
  const up = (value ?? 0) >= 0;
  const shown = useCountUp(value ?? 0);
  const enough = history.length >= 2;

  return (
    <div className="relative mt-5 overflow-hidden rounded-2xl border border-edge bg-gradient-to-br from-surface via-surface to-panel p-5 sm:p-6">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl"
        style={{ background: up ? "rgba(217,185,106,.16)" : "rgba(240,78,69,.16)" }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="tag text-heat">THC Resale Index</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span
              className={`display text-6xl leading-none tabular-nums ${up ? "text-heat" : "text-volt"}`}
              style={{ textShadow: up ? "0 0 28px rgba(217,185,106,.35)" : "0 0 28px rgba(240,78,69,.35)" }}
            >
              {value === null ? "—" : `${up ? "+" : ""}${shown}%`}
            </span>
            <span className={`text-sm font-bold ${up ? "text-heat" : "text-volt"}`}>{up ? "▲" : "▼"}</span>
          </p>
          <p className="tag mt-1 text-smoke">median premium over retail</p>
        </div>

        {/* breadth */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Stat label="Listed" value={listed.toLocaleString("en-US")} />
          <Stat label="Two-sided" value={quoted.toLocaleString("en-US")} />
          <Stat label="Advancing" value={advancers.toLocaleString("en-US")} tone="up" />
          <Stat label="Declining" value={decliners.toLocaleString("en-US")} tone="down" />
        </div>
      </div>

      {/* the curve */}
      <div className="relative mt-5">
        {enough ? (
          <AreaChart points={history.map((h) => h.value)} up={up} />
        ) : (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-edge">
            <p className="px-4 text-center text-xs text-smoke">
              Index history starts today — the chart draws itself as real daily
              readings land. {history.length === 1 ? "1 reading so far." : "No readings yet."}
            </p>
          </div>
        )}
      </div>

      {/* breadth bar: advancing vs declining, real proportions */}
      {advancers + decliners > 0 && (
        <div className="relative mt-4">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-panel">
            <span
              className="breadth-grow h-full bg-heat"
              style={{ width: `${(advancers / (advancers + decliners)) * 100}%` }}
            />
            <span className="h-full flex-1 bg-volt/70" />
          </div>
          <p className="tag mt-1.5 text-smoke">
            market breadth · {Math.round((advancers / (advancers + decliners)) * 100)}% advancing
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div>
      <p className="tag text-smoke">{label}</p>
      <p
        className={`text-lg font-bold tabular-nums ${
          tone === "up" ? "text-heat" : tone === "down" ? "text-volt" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/** Area chart with a gradient fill and a stroke that draws itself in. */
function AreaChart({ points, up }: { points: number[]; up: boolean }) {
  const W = 600, H = 96, PAD = 6;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((v, i) => {
    const x = PAD + (i * (W - PAD * 2)) / Math.max(1, points.length - 1);
    const y = H - PAD - ((v - min) * (H - PAD * 2)) / span;
    return [x, y] as const;
  });
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)},${H} L${xy[0][0].toFixed(1)},${H} Z`;
  const stroke = up ? "#d9b96a" : "#f04e45";
  const id = up ? "gUp" : "gDown";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} className="area-fade" />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="line-draw"
        style={{ filter: `drop-shadow(0 0 6px ${stroke}66)` }}
      />
      {/* live dot on the latest reading */}
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="3.5" fill={stroke} className="pulse-dot" />
    </svg>
  );
}

/** Ease-out count-up. Respects reduced-motion by snapping to the value. */
function useCountUp(target: number, ms = 900) {
  const [n, setN] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(Math.abs(target));
      return;
    }
    const goal = Math.abs(target);
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(goal * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, ms]);
  return n;
}
