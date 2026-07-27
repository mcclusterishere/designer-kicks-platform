import Money from "@/components/Money";
import { formatUsd } from "@/lib/market";
import type { SeriesPoint } from "@/lib/priceHistory";

/**
 * A pair's price record. Two honest halves:
 *
 *  - "Since release" is computable today from two known facts (retail on
 *    drop day, and what it trades for now), so it works immediately.
 *  - The daily curve is drawn only from observations we actually recorded.
 *    Retroactive sneaker pricing isn't available for free, so this fills in
 *    one day at a time from the day tracking started — and says so plainly
 *    until there's enough to plot.
 */
export default function PriceHistoryCard({
  series,
  since,
  retailCents,
  lastCents,
}: {
  series: SeriesPoint[];
  since: { pct: number; days: number | null; annualisedPct: number | null } | null;
  retailCents: number | null;
  lastCents: number | null;
}) {
  const pts = series.map((s) => s.market ?? s.ebayNew ?? s.ebayUsed).filter((v): v is number => !!v);
  const enough = pts.length >= 2;
  const up = (since?.pct ?? 0) >= 0;

  return (
    <div className="mt-6 rounded-2xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="tag text-heat">Price record</p>
          {since ? (
            <>
              <p className={`display mt-1 text-4xl tabular-nums ${up ? "text-heat" : "text-volt"}`}>
                {up ? "+" : ""}{since.pct}%
              </p>
              <p className="tag mt-0.5 text-smoke">
                since release
                {since.days ? ` · ${since.days.toLocaleString("en-US")} days` : ""}
                {since.annualisedPct !== null ? ` · ${since.annualisedPct}%/yr` : ""}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-smoke">Not enough pricing to measure a return yet.</p>
          )}
        </div>
        <div className="flex gap-6">
          <div>
            <p className="tag text-smoke">Retail</p>
            <p className="font-mono text-lg font-bold tabular-nums text-white">
              <Money cents={retailCents} />
            </p>
          </div>
          <div>
            <p className="tag text-smoke">Last</p>
            <p className="font-mono text-lg font-bold tabular-nums text-white">
              <Money cents={lastCents} />
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        {enough ? (
          <Spark points={pts} up={up} />
        ) : (
          <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-edge px-4">
            <p className="text-center text-xs text-smoke">
              Daily tracking started {pts.length === 1 ? "today" : "recently"} — the curve draws
              itself as readings land. We record this pair every day from here on.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Spark({ points, up }: { points: number[]; up: boolean }) {
  const W = 600, H = 80, PAD = 4;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((v, i) => {
    const x = PAD + (i * (W - PAD * 2)) / Math.max(1, points.length - 1);
    const y = H - PAD - ((v - min) * (H - PAD * 2)) / span;
    return [x, y] as const;
  });
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)},${H} L${xy[0][0].toFixed(1)},${H} Z`;
  const c = up ? "#d9b96a" : "#f04e45";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="phg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.3" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#phg)" className="area-fade" />
      <path d={line} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" className="line-draw" />
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="3.5" fill={c} className="pulse-dot" />
    </svg>
  );
}
