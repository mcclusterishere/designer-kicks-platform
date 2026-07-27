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
          <AreaChart points={history} up={up} />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-edge">
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

/**
 * The index chart.
 *
 * A bare sparkline reads as decoration; a chart needs a scale you can
 * actually read a number off. So this carries a gridded plot area, a
 * labelled y-axis in percent, dated ends on the x-axis, and a dashed
 * zero-line wherever the window straddles retail — that line is the whole
 * story on a resale index, since above it means pairs are trading over
 * retail and below it means they aren't.
 *
 * Nothing here is interpolated. Each vertex is one recorded daily reading.
 */
function AreaChart({ points, up }: { points: Point[]; up: boolean }) {
  const W = 720, H = 220;
  const L = 44, R = 12, T = 14, B = 26; // gutters for the axes
  const plotW = W - L - R;
  const plotH = H - T - B;

  const vals = points.map((p) => p.value);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  // Pad the band so the line never rides the frame, and always include 0
  // when the data sits near it — a resale chart that hides the retail line
  // is hiding the only reference point that means anything.
  const padding = Math.max(2, (rawMax - rawMin) * 0.15);
  let lo = rawMin - padding;
  let hi = rawMax + padding;
  if (rawMin > 0 && rawMin < padding * 3) lo = Math.min(lo, 0);
  if (rawMax < 0 && rawMax > -padding * 3) hi = Math.max(hi, 0);
  const span = hi - lo || 1;

  const x = (i: number) => L + (i * plotW) / Math.max(1, points.length - 1);
  const y = (v: number) => T + plotH - ((v - lo) * plotH) / span;

  const xy = points.map((p, i) => [x(i), y(p.value)] as const);
  const line = xy.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)},${T + plotH} L${xy[0][0].toFixed(1)},${T + plotH} Z`;

  const stroke = up ? "#d9b96a" : "#f04e45";
  const id = up ? "gUp" : "gDown";
  const ticks = [hi, lo + span * 0.5, lo].map((v) => Math.round(v));
  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-52 w-full sm:h-56"
        role="img"
        aria-label={`Resale index over the last ${points.length} recorded readings, from ${Math.round(vals[0])} percent to ${Math.round(vals[vals.length - 1])} percent over retail.`}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.38" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines + y scale */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={L}
              x2={W - R}
              y1={y(t)}
              y2={y(t)}
              stroke="currentColor"
              strokeWidth="1"
              className="text-edge"
              opacity="0.55"
            />
            <text
              x={L - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-current text-smoke"
              style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}
            >
              {t > 0 ? `+${t}%` : `${t}%`}
            </text>
          </g>
        ))}

        {/* retail line — the reference that makes the rest mean something */}
        {lo < 0 && hi > 0 && (
          <line
            x1={L}
            x2={W - R}
            y1={y(0)}
            y2={y(0)}
            stroke="currentColor"
            strokeDasharray="4 4"
            strokeWidth="1.25"
            className="text-smoke"
            opacity="0.8"
          />
        )}

        <path d={area} fill={`url(#${id})`} className="area-fade" />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="line-draw"
          style={{ filter: `drop-shadow(0 0 6px ${stroke}66)` }}
        />
        <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="4" fill={stroke} className="pulse-dot" />

        {/* dated ends */}
        <text x={L} y={H - 6} className="fill-current text-smoke" style={{ fontSize: 11 }}>
          {dayLabel(points[0].at)}
        </text>
        <text x={W - R} y={H - 6} textAnchor="end" className="fill-current text-smoke" style={{ fontSize: 11 }}>
          {dayLabel(points[points.length - 1].at)}
        </text>
      </svg>
      <figcaption className="tag mt-1 text-smoke">
        {points.length} recorded reading{points.length === 1 ? "" : "s"} · median premium over retail · gaps are days
        nobody logged a price, never filled in
      </figcaption>
    </figure>
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
