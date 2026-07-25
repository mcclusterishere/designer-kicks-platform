import LocalMoney from "@/components/LocalMoney";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { fitsMember } from "@/lib/shoeSize";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { getMarketBoard, getHotBases, formatUsd, type MarketItem, type HotBase } from "@/lib/market";
import { getExchangeBoard, getIndexStats, getMovers, getIndexHistory, type SortKey } from "@/lib/exchange";
import ExchangeTable from "@/components/ExchangeTable";
import TickerTape from "@/components/TickerTape";
import IndexHero from "@/components/IndexHero";
import CatalogBoard from "@/components/CatalogBoard";
import PairChart from "@/components/PairChart";
import OfferForm from "@/components/OfferForm";
import { categoryLabel } from "@/lib/categories";
import { RESALE_ARTIST_ROYALTY_PCT } from "@/lib/resale";

export const metadata = {
  title: "The Market — Live Sneaker Exchange, Bid/Ask & Resale Index | The Heat Chart",
  description:
    "The sneaker exchange: every tracked pair as a live symbol with last price, premium over retail, and a real two-sided bid/ask from the used and new market. Plus one-of-one customs priced by the artists who built them.",
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
  fitsYou,
}: {
  item: MarketItem;
  rank: number | undefined;
  signedIn: boolean;
  fitsYou: boolean;
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
        {/* "We know you": this one-of-one was made in the member's size */}
        {fitsYou && (
          <span className="glow-heat absolute right-2 bottom-2 flex items-center gap-1 rounded bg-heat px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
            👟 Your size
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


/* ---------- page ---------- */

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; category?: string; q?: string; sort?: string; brand?: string; page?: string; g?: string }>;
}) {
  await finalizeExpiredBattles();
  const sp = await searchParams;
  const { category = "all", q = "", sort = "hot", brand = "all", page = "1", g = "" } = sp;

  // One tab, four views. The exchange leads because the chart is the thing
  // people came to look at; "og" is kept as an alias so every link already
  // in the wild still lands on the book.
  const raw = sp.board ?? "exchange";
  const board: "exchange" | "catalog" | "customs" = raw === "customs"
    ? "customs"
    : raw === "catalog"
      ? "catalog"
      : "exchange";
  const og = board === "exchange";
  const needle = q.trim().toLowerCase();

  const [session, customsBoard, ogBoard, heat, hotBases] = await Promise.all([
    auth(),
    board === "customs" ? getMarketBoard() : null,
    og ? getExchangeBoard({ q, brand: brand === "all" ? undefined : brand, sort: (["last","change","spread","volume","name","recent"].includes(sort) ? sort : "last") as SortKey, page: Number(page) || 1 }) : null,
    board === "customs" ? getHeatList() : Promise.resolve([]),
    og ? getHotBases() : Promise.resolve([]),
  ]);
  const heatRank = new Map(heat.map((h, i) => [h.id, i + 1]));
  // The member's passport size powers the "your size" badge on customs.
  const memberSize = session?.user?.id
    ? (await prisma.user
        .findUnique({ where: { id: session.user.id }, select: { shoeSize: true } })
        .catch(() => null))?.shoeSize ?? null
    : null;

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
            {board === "exchange"
              ? "Retail drops tracked against live resale — chart, book and spread."
              : board === "catalog"
                ? "The same pairs, laid out to browse."
                : "One-of-one customs priced by the artists who built them."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/available"
              className="inline-block rounded-full border border-volt px-3 py-1 tag font-bold text-volt transition hover:bg-volt/10"
            >
              ⚡ Available now — ships without a wait
            </Link>
            <Link
              href="/predict"
              className="inline-block rounded-full border border-heat px-3 py-1 tag font-bold text-heat transition hover:bg-heat/10"
            >
              🎯 Think you can call it? — The Call
            </Link>
          </div>
        </div>

        {/* One market, three ways to read it. The catalog used to be its own
            top-level tab, which asked people to know that two words meant one
            set of shoes — it's a view here now. */}
        <div
          className="flex w-full items-center rounded-full border border-edge bg-surface p-1 sm:w-auto"
          role="tablist"
          aria-label="How to view the market"
        >
          {(
            [
              { key: "exchange", label: "📈 Chart", tone: "bg-heat text-ink" },
              { key: "catalog", label: "▦ Browse", tone: "bg-volt text-ink" },
              { key: "customs", label: "✦ Customs", tone: "bg-volt text-ink" },
            ] as const
          ).map((t) => (
            <Link
              key={t.key}
              href={t.key === "exchange" ? "/market" : `/market?board=${t.key}`}
              role="tab"
              aria-selected={board === t.key}
              className={`${switchBase} ${board === t.key ? t.tone : "text-smoke hover:text-white"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {board === "catalog" ? (
        <CatalogBoard q={q} brand={brand === "all" ? "" : brand} page={page} g={g} />
      ) : og && ogBoard ? (
        <ExchangeFloor exchange={ogBoard!} hotBases={hotBases} q={q} sort={sort} brand={brand} />
      ) : customsBoard ? (
        <CustomsBoardView
          board={customsBoard}
          heatRank={heatRank}
          signedIn={Boolean(session?.user)}
          category={category}
          q={q}
          needle={needle}
          sort={sort}
          memberSize={memberSize}
        />
      ) : null}

      <p className="mt-10 rounded-lg border border-edge bg-surface px-4 py-3 text-xs leading-relaxed text-smoke">
        {board !== "customs"
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
  memberSize,
}: {
  board: Awaited<ReturnType<typeof getMarketBoard>>;
  heatRank: Map<string, number>;
  signedIn: boolean;
  category: string;
  q: string;
  needle: string;
  sort: string;
  memberSize: string | null;
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
            <CustomTile
              key={item.id}
              item={item}
              rank={heatRank.get(item.id)}
              signedIn={signedIn}
              fitsYou={fitsMember(item.size, memberSize)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- OG board ---------- */

/**
 * Pick the pair worth putting a chart on: the one that has moved furthest
 * from retail among pairs we can actually draw. The index needs days of
 * history before it has a shape, but a single pair's track is drawable the
 * moment it has a release date and a retail price, so the floor always has
 * a real graph on it rather than an empty frame.
 */
async function getSpotlightTrack() {
  const candidates = await prisma.catalogShoe.findMany({
    where: {
      releaseDate: { not: null },
      retailPriceCents: { gt: 0 },
      OR: [{ marketPriceCents: { gt: 0 } }, { ebayNewCents: { gt: 0 } }],
    },
    orderBy: { marketPriceCents: "desc" },
    take: 60,
    select: {
      id: true, sku: true, name: true, releaseDate: true,
      retailPriceCents: true, marketPriceCents: true, ebayNewCents: true,
    },
  });
  if (candidates.length === 0) return null;

  const best = candidates
    .map((s) => ({
      s,
      gap: Math.abs(((s.marketPriceCents ?? s.ebayNewCents ?? 0) - s.retailPriceCents!) / s.retailPriceCents!),
    }))
    .sort((a, b) => b.gap - a.gap)[0].s;

  const { getPriceTrack } = await import("@/lib/priceHistory");
  const points = await getPriceTrack(best);
  return points.length >= 2 ? { points, name: best.name, sku: best.sku } : null;
}

async function ExchangeFloor({
  exchange,
  hotBases,
  q,
  sort,
  brand,
}: {
  exchange: Awaited<ReturnType<typeof getExchangeBoard>>;
  hotBases: HotBase[];
  q: string;
  sort: string;
  brand: string;
}) {
  const { rows, total, page, pages, brands } = exchange;
  const [index, movers, history, spotlight] = await Promise.all([
    getIndexStats(),
    getMovers(),
    getIndexHistory(30),
    getSpotlightTrack(),
  ]);

  return (
    <>
      {/* The tape */}
      <div className="mt-5 -mx-4">
        <TickerTape movers={movers} />
      </div>

      <IndexHero
        value={index.indexValue}
        history={history.map((h) => ({ at: h.at.toISOString(), value: h.value }))}
        listed={index.listed}
        quoted={index.quoted}
        advancers={index.advancers}
        decliners={index.decliners}
      />

      {/* The pair chart. The index needs days before it has a shape; this
          is drawable today, so the floor is never a chartless "market". */}
      {spotlight && (
        <PairChart
          points={spotlight.points}
          name={spotlight.name}
          sku={spotlight.sku}
          className="mt-5"
        />
      )}

      {/* Hot bases — what the culture actually builds on */}
      {hotBases.length > 0 && (
        <div className="mt-5">
          <p className="tag text-smoke">Hot bases — most customized in the league</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {hotBases.map((hb) => (
              <Link
                key={hb.silhouette}
                href={`/market?q=${encodeURIComponent(hb.silhouette)}`}
                className="shrink-0 rounded-lg border border-edge bg-surface px-3 py-2 transition hover:border-volt/50"
              >
                <p className="text-xs font-bold text-white">{hb.silhouette}</p>
                <p className="mt-0.5 text-[11px] tabular-nums text-smoke">
                  {hb.customsBuilt} custom{hb.customsBuilt === 1 ? "" : "s"}
                  {hb.recentBuilds > 0 && <span className="text-volt"> · {hb.recentBuilds} this month</span>}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search / filter the floor */}
      <form method="GET" action="/market" className="mt-5 flex flex-wrap gap-2">
        <input type="hidden" name="board" value="og" />
        <input type="hidden" name="sort" value={sort} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search ticker or pair…"
          aria-label="Search symbols"
          className="min-w-0 flex-1 rounded-md border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50"
        />
        <select
          name="brand"
          defaultValue={brand}
          aria-label="Filter by brand"
          className="rounded-md border border-edge bg-surface px-2 py-2 text-sm text-white"
        >
          <option value="all">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <button className="rounded-md btn-hard px-4 py-2 tag font-bold">Go</button>
      </form>

      <ExchangeTable
        rows={rows}
        sort={(sort as SortKey) ?? "last"}
        query={q || undefined}
        brand={brand === "all" ? undefined : brand}
        page={page}
        pages={pages}
        total={total}
      />
    </>
  );
}

