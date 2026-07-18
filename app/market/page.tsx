import Link from "next/link";
import { auth } from "@/auth";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { getMarketBoard, formatUsd } from "@/lib/market";
import OfferForm from "@/components/OfferForm";
import { categoryLabel } from "@/lib/categories";

export const metadata = {
  title: "The Custom Market — One-of-One Sneakers & Apparel | The Heat Chart",
  description:
    "Live pricing index for one-of-one custom sneakers and apparel: last sale prices, verified sales, and open asks from the arena's artists and collectors.",
};
export const dynamic = "force-dynamic";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "sneakers", label: "Sneakers" },
  { key: "apparel", label: "Apparel" },
  { key: "accessories", label: "Accessories" },
];

const SORTS = [
  { key: "hot", label: "Hottest" },
  { key: "price-high", label: "Price ↓" },
  { key: "price-low", label: "Price ↑" },
] as const;

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string }>;
}) {
  await finalizeExpiredBattles();
  const { category = "all", q = "", sort = "hot" } = await searchParams;
  const [session, { items, stats }, heat] = await Promise.all([
    auth(),
    getMarketBoard(),
    getHeatList(),
  ]);
  const heatRank = new Map(heat.map((h, i) => [h.id, i + 1]));

  const needle = q.trim().toLowerCase();
  const price = (i: (typeof items)[number]) =>
    i.lastSaleCents ?? i.askCents ?? i.topOfferCents ?? 0;
  const filtered = items
    .filter((i) => category === "all" || i.category === category)
    .filter(
      (i) =>
        !needle ||
        [i.title, i.artistName, i.baseShoe].some((s) => s.toLowerCase().includes(needle))
    )
    .sort((a, b) =>
      sort === "price-high" ? price(b) - price(a) : sort === "price-low" ? price(a) - price(b) : 0
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="tag text-volt">The pricing index</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        The Custom Market
      </h1>
      <p className="mt-3 max-w-2xl text-smoke">
        Real sale prices for one-of-one customs — sneakers, apparel, and
        accessories from independent artists. ✓ means the sale was
        substantiated with evidence; asks are what owners want, offers are
        what buyers are ready to pay. Deals settle directly between you two.
      </p>

      {/* The fee gauntlet: undercut every marketplace taking 8-13% */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-volt/40 bg-volt/5 px-4 py-3">
        <p className="display text-lg text-volt">Seller fee here: 1%</p>
        <p className="text-xs text-smoke">
          when on-platform checkout opens (plus card processing). Recording
          sales, asks, and offers is free forever. Elsewhere: 8–13%.
        </p>
      </div>

      {/* Index stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total volume", value: formatUsd(stats.volumeCents) },
          { label: "Sales recorded", value: stats.salesCount },
          { label: "Average sale", value: stats.salesCount ? formatUsd(stats.avgCents) : "—" },
          { label: "Verified sales", value: stats.verifiedCount },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-edge bg-surface p-4 text-center">
            <p className="display text-2xl text-volt">{s.value}</p>
            <p className="tag mt-1 text-smoke">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Category filter + search + sort */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={c.key === "all" ? "/market" : `/market?category=${c.key}`}
            className={`tag shrink-0 rounded-full border px-4 py-2 transition ${
              category === c.key
                ? "border-volt bg-volt/10 text-volt"
                : "border-edge text-smoke hover:border-volt hover:text-white"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>
      <form method="GET" action="/market" className="mt-3 flex flex-wrap gap-2">
        {category !== "all" && <input type="hidden" name="category" value={category} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search pieces, artists, silhouettes…"
          className="min-w-0 flex-1 rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white"
          aria-label="Sort the board"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <button type="submit" className="tag rounded-lg border border-edge px-4 py-2 text-white transition hover:border-volt">
          Go
        </button>
      </form>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-edge bg-surface p-10 text-center">
          <p className="display text-2xl text-white">The board opens with the first price</p>
          <p className="mx-auto mt-2 max-w-md text-smoke">
            Sales recorded by artists, asks set by owners, and offers from
            buyers all land here automatically. First mover writes the index.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const rank = heatRank.get(item.id);
            return (
              <div
                key={item.id}
                className="group overflow-hidden rounded-xl border border-edge bg-surface transition hover:border-volt/50"
              >
                <div className="relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={`${item.title} — custom ${item.baseShoe}`}
                    className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                  {rank && (
                    <span className="tag absolute left-2 top-2 rounded bg-ink/85 px-2 py-1 font-bold text-volt">
                      #{rank} Heat
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="tag text-smoke">
                    {categoryLabel(item.category)} · {item.baseShoe}
                    {item.size && <span className="text-white"> · {item.size}</span>}
                  </p>
                  <p className="mt-1 font-bold text-white">{item.title}</p>
                  <p className="mt-0.5 text-sm text-smoke">
                    by{" "}
                    {item.artistSlug ? (
                      <Link href={`/artists/${item.artistSlug}`} className="text-volt underline">
                        {item.artistName}
                      </Link>
                    ) : (
                      item.artistName
                    )}
                    {item.ownerSlug && (
                      <>
                        {" · owned by "}
                        <Link href={`/collectors/${item.ownerSlug}`} className="text-white underline">
                          {item.ownerName}
                        </Link>
                      </>
                    )}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-edge pt-3">
                    <div>
                      <p className="tag text-smoke">Last sale</p>
                      {item.lastSaleCents ? (
                        <>
                          <p className="display text-xl text-white">{formatUsd(item.lastSaleCents)}</p>
                          {item.lastSaleVerified ? (
                            <span className="tag text-volt" title="Substantiated with evidence or admin-verified">✓ verified</span>
                          ) : (
                            <span className="tag text-smoke">unverified</span>
                          )}
                        </>
                      ) : (
                        <p className="display text-xl text-smoke">—</p>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="tag text-smoke">Top offer</p>
                      <p className={`display text-xl ${item.topOfferCents ? "text-volt" : "text-smoke"}`}>
                        {item.topOfferCents ? formatUsd(item.topOfferCents) : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tag text-smoke">Ask</p>
                      <p className={`display text-xl ${item.askCents ? "text-heat" : "text-smoke"}`}>
                        {item.askCents ? formatUsd(item.askCents) : "—"}
                      </p>
                    </div>
                  </div>
                  <OfferForm submissionId={item.id} signedIn={Boolean(session?.user)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-10 rounded-xl border border-edge bg-surface p-4 text-xs text-smoke">
        Sales are recorded by sellers and confirmed by buyers on their own
        accounts. The ✓ verified badge means the sale was substantiated with
        a receipt or payment evidence (or verified by an admin). Unverified
        prices are self-reported — weigh them accordingly.
      </p>
    </div>
  );
}
