import Link from "next/link";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { getMarketBoard, formatUsd } from "@/lib/market";

export const metadata = {
  title: "The Custom Market — One-of-One Sneakers & Apparel | Designer Kicks",
  description:
    "Live pricing index for one-of-one custom sneakers and apparel: last sale prices, verified sales, and open asks from the arena's artists and collectors.",
};
export const dynamic = "force-dynamic";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "sneakers", label: "👟 Sneakers" },
  { key: "apparel", label: "🧥 Apparel" },
  { key: "accessories", label: "🧢 Accessories" },
];

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await finalizeExpiredBattles();
  const { category = "all" } = await searchParams;
  const [{ items, stats }, heat] = await Promise.all([getMarketBoard(), getHeatList()]);
  const heatRank = new Map(heat.map((h, i) => [h.id, i + 1]));

  const filtered = category === "all" ? items : items.filter((i) => i.category === category);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="tag text-volt">The pricing index</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        The Custom <span className="text-gradient-volt">Market</span>
      </h1>
      <p className="mt-3 max-w-2xl text-smoke">
        Real sale prices for one-of-one customs — sneakers, apparel, and
        accessories from independent artists. ✓ means the sale was
        substantiated with evidence; asks are what current owners want.
        Buying and selling settles directly with the artist or owner for now.
      </p>

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

      {/* Category filter */}
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

      {filtered.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-edge bg-surface p-8 text-center text-smoke">
          No priced pieces here yet — sales recorded by artists and asks set
          by owners show up automatically.
        </p>
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
                    {item.baseShoe} · {item.category}
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
                  <div className="mt-3 flex items-center justify-between border-t border-edge pt-3">
                    <div>
                      <p className="tag text-smoke">Last sale</p>
                      {item.lastSaleCents ? (
                        <p className="display text-xl text-white">
                          {formatUsd(item.lastSaleCents)}{" "}
                          {item.lastSaleVerified ? (
                            <span className="tag text-volt" title="Substantiated with evidence or admin-verified">✓ verified</span>
                          ) : (
                            <span className="tag text-smoke">unverified</span>
                          )}
                        </p>
                      ) : (
                        <p className="display text-xl text-smoke">—</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="tag text-smoke">Ask</p>
                      <p className={`display text-xl ${item.askCents ? "text-heat" : "text-smoke"}`}>
                        {item.askCents ? formatUsd(item.askCents) : "—"}
                      </p>
                    </div>
                  </div>
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
