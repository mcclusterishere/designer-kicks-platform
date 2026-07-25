import Link from "next/link";
import type { TrackPoint } from "@/lib/priceHistory";

/**
 * One pair's price track, drawn from its drop date to today.
 *
 * This is the chart people actually came for: not an abstract index, but
 * "what did this shoe cost when it dropped and what does it cost now."
 *
 * It draws the honest thing. The release anchor and the live price are
 * facts we can state today; the readings between them are observations
 * logged since we started recording. The segment between the anchor and
 * the first real observation is dashed, because we know both ends but not
 * the path — a solid line there would be a claim we can't support.
 */
export default function PairChart({
  points,
  name,
  sku,
  className = "",
}: {
  points: TrackPoint[];
  name: string;
  sku: string;
  className?: string;
}) {
  if (points.length < 2) return null;

  const W = 720, H = 240;
  const L = 52, R = 14, T = 16, B = 28;
  const plotW = W - L - R;
  const plotH = H - T - B;

  const vals = points.map((p) => p.cents);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const pad = Math.max(500, (rawMax - rawMin) * 0.18);
  const lo = Math.max(0, rawMin - pad);
  const hi = rawMax + pad;
  const span = hi - lo || 1;

  const t0 = points[0].at.getTime();
  const t1 = points[points.length - 1].at.getTime();
  const tSpan = t1 - t0 || 1;

  // Time-proportional x, not index-proportional: three years between the
  // drop and the first reading shouldn't render the same width as a day.
  const x = (d: Date) => L + ((d.getTime() - t0) * plotW) / tSpan;
  const y = (c: number) => T + plotH - ((c - lo) * plotH) / span;

  const xy = points.map((p) => [x(p.at), y(p.cents)] as const);

  // Split at the first observation: anchor→observed is inferred, the rest
  // is recorded.
  const firstRecorded = points.findIndex((p) => p.kind !== "retail");
  const bridgeEnd = firstRecorded > 0 ? firstRecorded : 0;

  const path = (from: number, to: number) =>
    xy.slice(from, to + 1).map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");

  const solid = bridgeEnd < points.length - 1 ? path(bridgeEnd, points.length - 1) : "";
  const dashed = bridgeEnd > 0 ? path(0, bridgeEnd) : "";

  const first = points[0];
  const last = points[points.length - 1];
  const changePct = Math.round(((last.cents - first.cents) / first.cents) * 100);
  const up = last.cents >= first.cents;
  const stroke = up ? "#d9b96a" : "#f04e45";

  const usd = (c: number) => `$${Math.round(c / 100).toLocaleString("en-US")}`;
  const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const ticks = [hi, lo + span / 2, lo].map(Math.round);

  return (
    <div className={`rounded-2xl border border-edge bg-surface p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tag text-heat">Since it dropped</p>
          <Link href={`/catalog/${encodeURIComponent(sku)}`} className="block truncate text-lg font-bold text-white hover:text-volt">
            {name}
          </Link>
          <p className="tag text-smoke">{sku}</p>
        </div>
        <div className="text-right">
          <p className={`display text-3xl leading-none tabular-nums ${up ? "text-heat" : "text-volt"}`}>
            {up ? "+" : ""}{changePct}%
          </p>
          <p className="tag mt-0.5 text-smoke">
            {usd(first.cents)} → {usd(last.cents)}
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-56 w-full"
        role="img"
        aria-label={`${name} from ${usd(first.cents)} at release in ${day(first.at)} to ${usd(last.cents)} now, a ${changePct} percent change.`}
      >
        <defs>
          <linearGradient id={`pc-${sku.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeWidth="1" className="text-edge" opacity="0.55" />
            <text
              x={L - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-current text-smoke"
              style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}
            >
              {usd(t)}
            </text>
          </g>
        ))}

        {solid && (
          <path
            d={`${solid} L${xy[points.length - 1][0].toFixed(1)},${T + plotH} L${xy[bridgeEnd][0].toFixed(1)},${T + plotH} Z`}
            fill={`url(#pc-${sku.replace(/[^a-zA-Z0-9]/g, "")})`}
            className="area-fade"
          />
        )}
        {dashed && (
          <path d={dashed} fill="none" stroke={stroke} strokeWidth="2" strokeDasharray="5 5" opacity="0.65" strokeLinecap="round" />
        )}
        {solid && (
          <path d={solid} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="line-draw" />
        )}

        {/* the drop itself, and where it stands now */}
        <circle cx={xy[0][0]} cy={xy[0][1]} r="4" fill="none" stroke={stroke} strokeWidth="2" />
        <circle cx={xy[points.length - 1][0]} cy={xy[points.length - 1][1]} r="4.5" fill={stroke} className="pulse-dot" />

        <text x={L} y={H - 6} className="fill-current text-smoke" style={{ fontSize: 11 }}>
          {day(first.at)} · retail
        </text>
        <text x={W - R} y={H - 6} textAnchor="end" className="fill-current text-smoke" style={{ fontSize: 11 }}>
          today
        </text>
      </svg>

      <p className="tag mt-1 text-smoke">
        {dashed
          ? "Dashed = between the drop and our first reading. We know both ends, not the path, so we don't draw one."
          : "Solid throughout — every point is a recorded reading."}
      </p>
    </div>
  );
}
