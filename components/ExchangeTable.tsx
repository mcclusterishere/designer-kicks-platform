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
              rows.map((r) => {
                const up = (r.changePct ?? 0) >= 0;
                return (
                  <tr key={r.sku} className="border-b border-edge/50 transition hover:bg-panel/60">
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
                      {r.lastCents ? formatUsd(r.lastCents) : "—"}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums font-bold ${r.changePct === null ? "text-smoke" : up ? "text-emerald-400" : "text-red-400"}`}>
                      {r.changePct === null ? "—" : `${up ? "+" : ""}${r.changePct}%`}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-smoke sm:table-cell">
                      {r.bidCents ? formatUsd(r.bidCents) : "—"}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-smoke sm:table-cell">
                      {r.askCents ? formatUsd(r.askCents) : "—"}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-smoke lg:table-cell">
                      {r.spreadCents ? formatUsd(r.spreadCents) : "—"}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-smoke lg:table-cell">
                      {r.retailCents ? formatUsd(r.retailCents) : "—"}
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
