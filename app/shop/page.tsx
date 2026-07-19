import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import ProductCard from "@/components/ProductCard";
import { SHOP_LIVE } from "@/lib/flags";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER = [
  { key: "marketplace", label: "Cop The Heat", sub: "Marketplaces for hyped + rare pairs — every pair on the Drop Calendar lives here" },
  { key: "retail", label: "Fresh Releases", sub: "Launch-day retail: draws, raffles, and the GRs that restock" },
  { key: "customization", label: "Customizer Supplies", sub: "The paint, brushes, and airbrushes behind the customs in our battles" },
  { key: "cleaning", label: "Keep Them Clean", sub: "Care, cleaning, and protection — grails deserve maintenance" },
  { key: "accessories", label: "Laces & Extras", sub: "Lace swaps, display cases, crease shields, and more" },
];

export default async function ShopPage() {
  // Stashed until the affiliate programs are approved and the slate is
  // curated — drops carry the buy links in the meantime.
  if (!SHOP_LIVE) redirect("/drops");
  const products = await prisma.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const featured = products.filter((p) => p.featured);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="tag text-heat">The Market</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Everything the culture <span className="text-heat">wears & builds</span>
      </h1>
      <p className="mt-3 max-w-2xl text-smoke">
        Hand-picked, no filler: the marketplaces we trust for pairs, and the
        exact supplies the customizers in our battles paint with. Buying
        through these links backs the league — same price for you, every
        time.
      </p>
      <p className="mt-4 rounded-xl border border-edge bg-surface p-3 text-xs text-smoke">
        Disclosure: links on this page are affiliate links. The Heat Chart may
        earn a commission on qualifying purchases, at no additional cost to
        you. Prices shown are approximate and set by the merchant.
      </p>

      {featured.length > 0 && (
        <section className="mt-10">
          <h2 className="display text-2xl text-white">Editor&apos;s Picks</h2>
          <p className="mt-1 text-sm text-smoke">
            Start here — the picks that earn their spot.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {products.length === 0 && (
        <p className="mt-8 rounded-xl border border-edge bg-surface p-8 text-center text-smoke">
          The Market is being stocked — check back soon.
        </p>
      )}

      {CATEGORY_ORDER.map(({ key, label, sub }) => {
        const items = products.filter((p) => p.category === key && !p.featured);
        if (items.length === 0) return null;
        return (
          <section key={key} className="mt-12">
            <h2 className="display text-2xl text-white">{label}</h2>
            <p className="mt-1 text-sm text-smoke">{sub}</p>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-12 rounded-xl border border-edge bg-surface p-4 text-xs text-smoke">
        Disclosure: links on this page are affiliate links. The Heat Chart may
        earn a commission on qualifying purchases, at no additional cost to
        you. Prices shown are approximate and set by the merchant.
      </p>
    </div>
  );
}
