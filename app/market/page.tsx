import LocalMoney from "@/components/LocalMoney";
import Link from "next/link";
import { auth } from "@/auth";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { getMarketBoard, getOgBoard, getHotBases, formatUsd, type MarketItem, type OgItem, type HotBase } from "@/lib/market";
import OfferForm from "@/components/OfferForm";
import { categoryLabel } from "@/lib/categories";
import { RESALE_ARTIST_ROYALTY_PCT } from "@/lib/resale";

export const metadata = {
  title: "Market — Custom Heat & OG Drops, Priced Live | The Heat Chart",
  description:
    "The two sides of the sneaker market on one board: one-of-one customs priced by their artists, and OG retail drops tracked against live resale. Last sales, asks, offers, premiums.",
};
export const dynamic = "force-dynamic";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "sneakers", label: "Sneakers" },
  { key: "apparel", label: "Apparel" },
  { key: "accessories", label: "Accessories" },
  { key: "collabs", label: "Collabs" },
];

const SORTS = [
  { key: "hot", label: "Featured" },
  { key: "price-high", label: "Price: High → Low" },
  { key: "price-low", label: "Price: Low → High" },
  { key: "premium", label: "Premium %" },
] as const;

const OG_PAGE_SIZE = 60;

/* ---------- shared atoms ---------- */

function Delta({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-[11px] font-semibold tabular-nums text-smoke">0%</span>;
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
        up ? "text-emerald-400" : "text-red-400"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

/**
 * Honest sparkline: weekly samples in, one polyline out. Green when the
 * window closed higher than it opened, red when lower — the trading
 * convention buyers already read fluently.
 */
function Sparkline({
  series,
  width = 72,
  height = 24,
  strokeWidth = 1.6,
}: {
  series: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  if (series.length < 2) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pad = 2;
  const pts = series
    .map((v, i) => {
      const x = pad + (i * (width - pad * 2)) / (series.length - 1);
      const y = height - pad - ((v - min) * (height - pad * 2)) / span;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = series[series.length - 1] >= series[0];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width, height }}
      aria-hidden
      className="shrink-0"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "#34d399" : "#f87171"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatStrip({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-edge bg-surface">
      <div className="flex min-w-max divide-x divide-edge">
        {stats.map((s) => (
          <div key={s.label} className="flex-1 px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-smoke">{s.label}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-white">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- customs tile ---------- */

function CustomTile({
  item,
  rank,
  signedIn,
}: {
  item: MarketItem;
  rank: number | undefined;
  signedIn: boolean;
}) {
  const salePct =
    item.lastSaleCents && item.prevSaleCents
      ? Math.round(((item.lastSaleCents - item.prevSaleCents) / item.prevSaleCents) * 100)
      : null;
  const headline = item.askCents ?? item.lastSaleCents ?? item.topOfferCents;
  const headlineLabel = item.askCents ? "Ask" : item.lastSaleCents ? "Last Sale" : "Top Offer";
  return (
    <div className="group flex flex-col rounded-lg border border-edge bg-surface transition hover:border-smoke/60">
      <div className="relative overflow-hidden rounded-t-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={`${item.title} — custom ${item.baseShoe}`}
          className="aspect-square w-full object-cover"
        />
        {rank && rank <= 10 && (
          <span className="absolute left-2 top-2 rounded bg-ink/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-volt">
            #{rank} Heat
          </span>
        )}
        {item.collabWith.length > 0 && (
          <span className="absolute right-2 top-2 rounded bg-volt px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
            Collab
          </span>
        )}
        {item.consignment && (
          <span className="absolute bottom-2 left-2 rounded bg-heat px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
            Consigned
          </span>
        )}
        {item.ownerName && item.askCents && (
          <span className="absolute bottom-2 right-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
            Resale
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-sm font-semibold text-white" title={item.title}>
          {item.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-smoke">
          {item.artistSlug ? (
            <Link href={`/artists/${item.artistSlug}`} className="hover:text-white">
              {item.artistName}
            </Link>
          ) : (
            item.artistName
          )}
          {item.collabWith.map((c) => (
            <span key={c.slug}>
              {" × "}
              <Link href={`/artists/${c.slug}`} className="hover:text-white">
                {c.name}
              </Link>
            </span>
          ))}
          {" · "}
          {categoryLabel(item.category)}
          {item.size && ` · ${item.size}`}
          {item.provenanceType === "COMMISSION" && " · Commission"}
        </p>
        {item.consignment && (
          <p className="mt-1 text-[11px] leading-relaxed text-heat">
            Consignment relist
            {item.consignment.priorSaleCents
              ? ` — prior sale ${formatUsd(item.consignment.priorSaleCents)}`
              : ""}{" "}
            · proceeds split with a private collector
          </p>
        )}
        {item.ownerName && item.askCents && (
          <p className="mt-1 text-[11px] leading-relaxed text-smoke">
            Collector resale — {RESALE_ARTIST_ROYALTY_PCT}% royalty goes back to the artist
          </p>
        )}

        {/* The proprietary number: Heat Index, its 8-week tape, its 7-day move */}
        <div className="mt-2 flex items-center justify-between gap-2 rounded bg-ink/60 px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-heat">
            HX <span className="text-sm font-bold tabular-nums text-white">{item.hx.value}</span>
          </span>
          <Sparkline series={item.series} width={56} height={18} />
          <span
            className={`text-[11px] font-semibold tabular-nums ${
              item.hx.weekDelta > 0
                ? "text-emerald-400"
                : item.hx.weekDelta < 0
                  ? "text-red-400"
                  : "text-smoke"
            }`}
            title="Heat Index points moved in the last 7 days"
          >
            {item.hx.weekDelta > 0 ? "▲ +" : item.hx.weekDelta < 0 ? "▼ " : ""}
            {item.hx.weekDelta === 0 ? "flat" : `${item.hx.weekDelta} wk`}
          </span>
        </div>

        <div className="mt-2.5 border-t border-edge pt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-smoke">{headlineLabel}</p>
          <div className="flex items-baseline justify-between">
            <p className="text-xl font-bold tabular-nums text-white">
              {headline ? formatUsd(headline) : "—"}
            </p>
            {salePct !== null && <Delta pct={salePct} />}
          </div>
          {headline ? <LocalMoney usd={headline / 100} /> : null}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-smoke">
          <span>
            Last sale:{" "}
            <span className="text-white">{item.lastSaleCents ? formatUsd(item.lastSaleCents) : "—"}</span>
            {item.lastSaleCents !== null && item.lastSaleVerified && (
              <span className="ml-1 text-emerald-400" title="Substantiated with evidence or admin-verified">✓</span>
            )}
          </span>
          <span>
            {item.bidCount > 0 ? (
              <>
                {item.bidCount} bid{item.bidCount === 1 ? "" : "s"} · high{" "}
                <span className="font-bold text-emerald-400">{formatUsd(item.topOfferCents!)}</span>
              </>
            ) : item.consignment ? (
              <>Bids from <span className="font-bold text-white">{formatUsd(item.consignment.floorCents)}</span></>
            ) : (
              "No bids yet"
            )}
          </span>
        </div>
        <div className="mt-auto">
          <OfferForm
            submissionId={item.id}
            signedIn={signedIn}
            highBidCents={item.topOfferCents}
            floorCents={item.consignment?.floorCents ?? null}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- OG tile ---------- */

function OgTile({ item }: { item: OgItem }) {
  return (
    <Link
      href={`/catalog/${encodeURIComponent(item.sku)}`}
      className="group flex flex-col rounded-lg border border-edge bg-surface transition hover:border-smoke/60"
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-t-lg bg-white p-3">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="text-4xl">👟</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-white" title={item.name}>
          {item.name}
        </p>
        <div className="mt-2.5 border-t border-edge pt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-smoke">Market Value</p>
          <div className="flex items-baseline justify-between">
            <p className="text-xl font-bold tabular-nums text-white">{formatUsd(item.marketCents)}</p>
            {item.premiumPct !== null && <Delta pct={item.premiumPct} />}
          </div>
          <LocalMoney usd={item.marketCents / 100} />
        </div>
        {/* The spread: retail → eBay new → eBay used. Live medians from
            the auto-matcher; dashes until the eBay keys connect. */}
        <div className="mt-1.5 space-y-0.5 text-[11px] tabular-nums text-smoke">
          <p className="flex justify-between">
            <span>Retail</span>
            <span className="text-white">{item.retailCents ? formatUsd(item.retailCents) : "—"}</span>
          </p>
          <p className="flex justify-between">
            <span>eBay new</span>
            <span className="text-white">{item.ebayNewCents ? formatUsd(item.ebayNewCents) : "—"}</span>
          </p>
          <p className="flex justify-between">
            <span>eBay used</span>
            <span className="text-white">{item.ebayUsedCents ? formatUsd(item.ebayUsedCents) : "—"}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}

/* ---------- page ---------- */

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; category?: string; q?: string; sort?: string; brand?: string }>;
}) {
  await finalizeExpiredBattles();
  const { board = "customs", category = "all", q = "", sort = "hot", brand = "all" } = await searchParams;
  const og = board === "og";
  const needle = q.trim().toLowerCase();

  const [session, customsBoard, ogBoard, heat, hotBases] = await Promise.all([
    auth(),
    og ? null : getMarketBoard(),
    og ? getOgBoard() : null,
    og ? Promise.resolve([]) : getHeatList(),
    og ? getHotBases() : Promise.resolve([]),
  ]);
  const heatRank = new Map(heat.map((h, i) => [h.id, i + 1]));

  const switchBase =
    "flex-1 rounded-full px-5 py-2 text-center text-xs font-bold uppercase tracking-[0.14em] transition";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Exchange header: name, mode switch, live stats */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="tag text-volt">Live board</p>
          <h1 className="display mt-1 text-4xl text-white">The Market</h1>
          <p className="mt-1 text-sm text-smoke">
            {og
              ? "OG retail drops tracked against live resale value."
              : "One-of-one customs priced by the artists who built them."}
          </p>
        </div>

        {/* The switch: customs by night, OG drops by day */}
        <div
          className="flex w-full max-w-xs items-center rounded-full border border-edge bg-surface p-1 sm:w-auto"
          role="tablist"
          aria-label="Which market"
        >
          <Link
            href="/market"
            role="tab"
            aria-selected={!og}
            className={`${switchBase} ${!og ? "bg-volt text-ink" : "text-smoke hover:text-white"}`}
          >
            Customs
          </Link>
          <Link
            href="/market?board=og"
            role="tab"
            aria-selected={og}
            className={`${switchBase} ${og ? "bg-heat text-ink" : "text-smoke hover:text-white"}`}
          >
            OG Drops
          </Link>
        </div>
      </div>

      {og && ogBoard ? (
        <OgBoardView board={ogBoard} hotBases={hotBases} q={q} needle={needle} sort={sort} brand={brand} />
      ) : customsBoard ? (
        <CustomsBoardView
          board={customsBoard}
          heatRank={heatRank}
          signedIn={Boolean(session?.user)}
          category={category}
          q={q}
          needle={needle}
          sort={sort}
        />
      ) : null}

      <p className="mt-10 rounded-lg border border-edge bg-surface px-4 py-3 text-xs leading-relaxed text-smoke">
        {og
          ? "Market values are live resale figures (average / lowest ask) captured from our pricing providers and refreshed on re-import. Premium is resale vs retail. Figures are informational, not quotes."
          : "HX is the Heat Index — our proprietary score per piece. Votes, battle wins, standing bids, and sales push it up; cold ratings pull it down. The arrow is the last 7 days of movement. Bids are standing orders: the seller can execute at the high bid any time (Sell Now), which records the sale for the buyer to confirm — payment settles directly between members. ✓ means a sale was substantiated with evidence. Seller fee is 1% when on-platform checkout opens; the book is free forever."}
      </p>
    </div>
  );
}

/* ---------- customs board ---------- */

function CustomsBoardView({
  board,
  heatRank,
  signedIn,
  category,
  q,
  needle,
  sort,
}: {
  board: Awaited<ReturnType<typeof getMarketBoard>>;
  heatRank: Map<string, number>;
  signedIn: boolean;
  category: string;
  q: string;
  needle: string;
  sort: string;
}) {
  const { items, stats } = board;
  const price = (i: MarketItem) => i.askCents ?? i.lastSaleCents ?? i.topOfferCents ?? 0;
  const filtered = items
    .filter((i) =>
      category === "all" ? true : category === "collabs" ? i.collabWith.length > 0 : i.category === category
    )
    .filter(
      (i) =>
        !needle ||
        [i.title, i.artistName, i.baseShoe, ...i.collabWith.map((c) => c.name)].some((s) =>
          s.toLowerCase().includes(needle)
        )
    )
    .sort((a, b) =>
      sort === "price-high" ? price(b) - price(a) : sort === "price-low" ? price(a) - price(b) : 0
    );

  // The exchange index: element-wise average of every listed piece's
  // weekly HX series — the market's own tape, from real events only.
  const indexSeries =
    items.length > 0
      ? items[0].series.map((_, w) =>
          Math.round(items.reduce((s, i) => s + (i.series[w] ?? 0), 0) / items.length)
        )
      : [];
  const indexNow = indexSeries[indexSeries.length - 1] ?? 0;
  const indexPrev = indexSeries[indexSeries.length - 2] ?? indexNow;
  const indexDeltaPct = indexPrev > 0 ? Math.round(((indexNow - indexPrev) / indexPrev) * 100) : 0;

  return (
    <>
      {/* The desk header — the number a buyer sizes the room by */}
      <div className="mt-5 rounded-lg border border-edge bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-smoke">
              Confirmed volume · all-time
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-white sm:text-5xl">
              {formatUsd(stats.volumeCents)}
            </p>
            <p className="mt-1 text-xs tabular-nums text-smoke">
              {stats.salesCount} sale{stats.salesCount === 1 ? "" : "s"} ·{" "}
              {stats.verifiedCount} verified · avg{" "}
              {stats.salesCount ? formatUsd(stats.avgCents) : "—"}
            </p>
          </div>
          {indexSeries.length > 1 && (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-heat">
                Heat Index · 8W
              </p>
              <div className="mt-1 flex items-center justify-end gap-2">
                <Sparkline series={indexSeries} width={120} height={34} strokeWidth={2} />
                <div>
                  <p className="text-xl font-bold tabular-nums text-white">{indexNow}</p>
                  <Delta pct={indexDeltaPct} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <StatStrip
        stats={[
          { label: "Listed", value: String(items.length) },
          { label: "Open Bids", value: String(items.reduce((s, i) => s + i.bidCount, 0)) },
          { label: "High Bid", value: (() => { const h = Math.max(0, ...items.map((i) => i.topOfferCents ?? 0)); return h ? formatUsd(h) : "—"; })() },
          { label: "Consigned", value: String(items.filter((i) => i.consignment).length) },
          { label: "Collabs", value: String(items.filter((i) => i.collabWith.length > 0).length) },
        ]}
      />

      {/* Toolbar: chips + search + sort in one line */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <Link
              key={c.key}
              href={c.key === "all" ? "/market" : `/market?category=${c.key}`}
              className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                category === c.key
                  ? "border-volt bg-volt/10 text-volt"
                  : "border-edge text-smoke hover:border-smoke hover:text-white"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>
        <form method="GET" action="/market" className="ml-auto flex min-w-0 flex-1 gap-2 sm:max-w-md">
          {category !== "all" && <input type="hidden" name="category" value={category} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search pieces, artists, silhouettes"
            placeholder="Search the board…"
            className="min-w-0 flex-1 rounded-md border border-edge bg-surface px-3 py-1.5 text-sm text-white placeholder:text-smoke/60 focus:border-volt focus:outline-none"
          />
          <select
            name="sort"
            defaultValue={sort}
            aria-label="Sort the board"
            className="rounded-md border border-edge bg-surface px-2 py-1.5 text-xs text-white"
          >
            {SORTS.filter((s) => s.key !== "premium").map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-edge px-3 py-1.5 text-xs font-semibold text-white transition hover:border-volt"
          >
            Go
          </button>
        </form>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-edge bg-surface p-10 text-center">
          <p className="display text-2xl text-white">
            {category === "collabs" ? "First collab writes history" : "The board opens with the first price"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-smoke">
            {category === "collabs"
              ? "When two artists build one piece and tag each other at upload, it lands here with both names on it."
              : "Artists set asks at upload, owners record sales, buyers put up offers — all of it lands here automatically."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <CustomTile key={item.id} item={item} rank={heatRank.get(item.id)} signedIn={signedIn} />
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- OG board ---------- */

function OgBoardView({
  board,
  hotBases,
  q,
  needle,
  sort,
  brand,
}: {
  board: Awaited<ReturnType<typeof getOgBoard>>;
  hotBases: HotBase[];
  q: string;
  needle: string;
  sort: string;
  brand: string;
}) {
  const { items, stats, brands } = board;
  const filtered = items
    .filter((i) => brand === "all" || i.brand === brand)
    .filter((i) => !needle || i.name.toLowerCase().includes(needle) || i.sku.toLowerCase().includes(needle))
    .sort((a, b) =>
      sort === "price-low"
        ? a.marketCents - b.marketCents
        : sort === "premium"
          ? (b.premiumPct ?? -Infinity) - (a.premiumPct ?? -Infinity)
          : b.marketCents - a.marketCents
    );
  const page = filtered.slice(0, OG_PAGE_SIZE);

  return (
    <>
      {/* Hot Bases — what the culture is actually building on. Price
          feeds say what a pair costs; this says what pairs get CHOSEN,
          and what the work turns them into. */}
      {hotBases.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-smoke">
            Hot bases — most customized in the league
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {hotBases.map((hb) => (
              <Link
                key={hb.silhouette}
                href={`/market?board=og&q=${encodeURIComponent(hb.silhouette)}`}
                className="shrink-0 rounded-lg border border-edge bg-surface px-3 py-2 transition hover:border-volt/50"
              >
                <p className="text-xs font-bold text-white">{hb.silhouette}</p>
                <p className="mt-0.5 text-[11px] tabular-nums text-smoke">
                  {hb.customsBuilt} custom{hb.customsBuilt === 1 ? "" : "s"}
                  {hb.recentBuilds > 0 && <span className="text-volt"> · {hb.recentBuilds} this month</span>}
                  {hb.avgCustomAskCents && (
                    <span> · avg ask {formatUsd(hb.avgCustomAskCents)}</span>
                  )}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <StatStrip
        stats={[
          { label: "Pairs Tracked", value: stats.tracked.toLocaleString("en-US") },
          { label: "Avg Premium", value: stats.avgPremiumPct !== null ? `${stats.avgPremiumPct > 0 ? "+" : ""}${stats.avgPremiumPct}%` : "—" },
          {
            label: "Top Gainer",
            value: stats.topGainer ? `+${stats.topGainer.premiumPct}%` : "—",
          },
          { label: "Source", value: "Live resale" },
        ]}
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <form method="GET" action="/market" className="flex min-w-0 flex-1 flex-wrap gap-2">
          <input type="hidden" name="board" value="og" />
          <select
            name="brand"
            defaultValue={brand}
            aria-label="Filter by brand"
            className="rounded-md border border-edge bg-surface px-2 py-1.5 text-xs text-white"
          >
            <option value="all">All brands</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search name or SKU"
            placeholder="Search name or SKU…"
            className="min-w-0 flex-1 rounded-md border border-edge bg-surface px-3 py-1.5 text-sm text-white placeholder:text-smoke/60 focus:border-volt focus:outline-none"
          />
          <select
            name="sort"
            defaultValue={sort === "hot" ? "price-high" : sort}
            aria-label="Sort the board"
            className="rounded-md border border-edge bg-surface px-2 py-1.5 text-xs text-white"
          >
            {SORTS.filter((s) => s.key !== "hot").map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-edge px-3 py-1.5 text-xs font-semibold text-white transition hover:border-volt"
          >
            Go
          </button>
        </form>
      </div>

      {page.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-edge bg-surface p-10 text-center">
          <p className="display text-2xl text-white">No pairs match</p>
          <p className="mt-2 text-sm text-smoke">Loosen the search or switch brands.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {page.map((item) => (
              <OgTile key={item.sku} item={item} />
            ))}
          </div>
          {filtered.length > page.length && (
            <p className="mt-4 text-center text-xs text-smoke">
              Showing {page.length} of {filtered.length.toLocaleString("en-US")} — search or filter to narrow it, or
              browse the full{" "}
              <Link href="/catalog" className="text-volt underline">catalog</Link>.
            </p>
          )}
        </>
      )}
    </>
  );
}
