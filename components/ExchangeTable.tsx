import Money from "@/components/Money";
import CurrencyNote, { UsdSubLine } from "@/components/CurrencyNote";
import Link from "next/link";
import { formatUsd } from "@/lib/market";
import type { Row, SortKey } from "@/lib/exchange";

const COLS: { key: SortKey | null; label: string; align?: string; hide?: string }[] = [
  { key: "name", label: "Symbol / Pair" },
  { key: "last", label: "Last", align: "text-right" },
  { key: "change", label: "Chg%", align: "text-right" },
  { key: null, label: "Bid", align: "text-right", hide: "hidden sm:table-cell" },
  { key: null, label: "Ask", align: "text-right", hide: "hidden sm:table-cell" },
  { key: "spread", label: "Spread", align: "text-right", hide: "hidden lg:table-cell" },
  { key: null, label: "Retail", align: "text-right", hide: "hidden lg:table-cell" },
];

function href(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  const merged = { ...base, ...patch };
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  return `/market?${p.toString()}`;
}

/**
 * The order book. Dense, monospaced, right-aligned numbers — a real
 * exchange reads like a terminal, not a product grid. Bid/Ask are the live
 * eBay used/new legs, so the spread is an actual two-sided market rather
 * than decoration. A dash means we don't have that quote, never a guess.
 */
export default function ExchangeTable({
  rows,
  sort,
  query,
  brand,
  page,
  pages,
  total,
}: {
  rows: Row[];
  sort: SortKey;
  query?: string;
  brand?: string;
  page: number;
  pages: number;
  total: number;
}) {
  const base = { board: "og", q: query, brand, sort };

  return (
    <div className="mt-4">
      <div className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-panel">
              {COLS.map((c) => (
                <th
                  key={c.label}
                  className={`whitespace-nowrap border-b border-edge px-3 py-2.5 text-left tag text-smoke ${c.align ?? ""} ${c.hide ?? ""}`}
                >
                  {c.key ? (
                    <Link
                      href={href(base, { sort: c.key, page: undefined })}
                      className={`hover:text-volt ${sort === c.key ? "text-volt" : ""}`}
                    >
                      {c.label}
                      {sort === c.key ? " ↓" : ""}
                    </Link>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="px-3 py-8 text-center text-smoke">
                  No symbols match. Loosen the search or switch brands.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const up = (r.changePct ?? 0) >= 0;
                return (
                  <tr
                    key={r.sku}
                    className="row-in border-b border-edge/50 transition hover:bg-panel/70"
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    <td className="px-3 py-2.5">
                      <Link href={`/catalog/${encodeURIComponent(r.sku)}`} className="flex items-center gap-2.5">
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded bg-panel object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-panel text-xs">👟</span>
                        )}
                        <span className="min-w-0">
                          <span className="block font-mono text-xs font-bold tracking-wider text-white">{r.sku}</span>
                          <span className="block max-w-[15rem] truncate text-xs text-smoke">{r.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums font-bold text-white">
                      <Money cents={r.lastCents} showUsd={false} />
                      {/* The dollar price under the local one: this column is
                          the headline number, so both belong here even though
                          the narrower columns only carry one. */}
                      {r.lastCents ? (
                        <UsdSubLine cents={r.lastCents} />
                      ) : null}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums font-bold ${r.changePct === null ? "text-smoke" : up ? "text-emerald-400" : "text-red-400"}`}>
                      {r.changePct === null ? "—" : `${up ? "+" : ""}${r.changePct}%`}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-smoke sm:table-cell">
                      <Money cents={r.bidCents} showUsd={false} />
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-smoke sm:table-cell">
                      <Money cents={r.askCents} showUsd={false} />
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-right lg:table-cell">
                      {r.spreadCents && r.bidCents && r.askCents ? (
                        <span className="inline-flex flex-col items-end gap-1">
                          <span className="font-mono tabular-nums text-smoke"><Money cents={r.spreadCents} showUsd={false} /></span>
                          <Ladder bid={r.bidCents} ask={r.askCents} last={r.lastCents} />
                        </span>
                      ) : (
                        <span className="font-mono tabular-nums text-smoke">—</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-smoke lg:table-cell">
                      <Money cents={r.retailCents} showUsd={false} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="tag text-smoke">
          {total.toLocaleString("en-US")} symbols listed · page {page} of {pages}
          <span className="ml-2 hidden sm:inline">· Bid/Ask = live eBay used/new</span>
          {/* The columns are too narrow to carry a dollar reference beside
              every figure, so the unit is stated once for the whole table. */}
          <CurrencyNote />
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={href(base, { page: String(page - 1) })} className="rounded border border-edge px-3 py-1.5 tag text-white">
              ← Prev
            </Link>
          )}
          {page < pages && (
            <Link href={href(base, { page: String(page + 1) })} className="rounded border border-edge px-3 py-1.5 tag text-white">
              Next →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Where the last price sits inside the live bid/ask band. Pure real data:
 * the rail spans used→new and the marker is the last traded price clamped
 * into that range, so a wide spread visibly reads as a loose market.
 */
function Ladder({ bid, ask, last }: { bid: number; ask: number; last: number | null }) {
  const span = ask - bid;
  const pos = last && span > 0 ? Math.min(1, Math.max(0, (last - bid) / span)) : null;
  return (
    <span className="relative block h-1 w-16 overflow-hidden rounded-full bg-panel" aria-hidden>
      <span className="ladder-grow absolute inset-0 bg-gradient-to-r from-volt/50 via-smoke/30 to-heat/60" />
      {pos !== null && (
        <span
          className="absolute top-1/2 h-2 w-[2px] -translate-y-1/2 bg-white"
          style={{ left: `calc(${(pos * 100).toFixed(0)}% - 1px)` }}
        />
      )}
    </span>
  );
}
