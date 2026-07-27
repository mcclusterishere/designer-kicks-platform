import Money from "@/components/Money";
import Link from "next/link";
import { formatUsd } from "@/lib/market";

/**
 * The tape. Scrolls the biggest real movers across the top of the floor —
 * ticker, last price, and premium over retail. Duplicated once so the
 * marquee loops seamlessly; pure CSS so there's no JS cost.
 */
export default function TickerTape({
  movers,
}: {
  movers: { sku: string; name: string; changePct: number; lastCents: number }[];
}) {
  if (movers.length === 0) return null;
  const run = [...movers, ...movers];

  return (
    <div className="relative overflow-hidden border-y border-edge bg-ink">
      <div className="ticker-track flex w-max items-center gap-8 py-2">
        {run.map((m, i) => {
          const up = m.changePct >= 0;
          return (
            <Link
              key={`${m.sku}-${i}`}
              href={`/catalog/${encodeURIComponent(m.sku)}`}
              className="flex shrink-0 items-center gap-2 font-mono text-xs"
            >
              <span className="font-bold tracking-wider text-white">{m.sku}</span>
              <span className="tabular-nums text-smoke"><Money cents={m.lastCents} showUsd={false} /></span>
              <span className={`tabular-nums font-bold ${up ? "text-emerald-400" : "text-red-400"}`}>
                {up ? "▲" : "▼"} {Math.abs(m.changePct)}%
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
