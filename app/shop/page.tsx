import { prisma } from "@/lib/db";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER = [
  { key: "marketplace", label: "Cop The Heat", sub: "Marketplaces for hyped + rare pairs" },
  { key: "retail", label: "Fresh Releases", sub: "Retailers for new drops" },
  { key: "customization", label: "Customizer Supplies", sub: "Paints, brushes, finishers — build your own heat" },
  { key: "cleaning", label: "Keep Them Clean", sub: "Care, cleaning, and protection" },
  { key: "accessories", label: "Laces & Extras", sub: "Laces, trees, storage, and more" },
];

export default async function ShopPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="tag text-heat">Affiliate marketplace</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        The <span className="text-heat">Shop</span>
      </h1>
      <p className="mt-3 max-w-2xl text-smoke">
        Everything the culture is wearing and everything customizers use to
        build it. We hand-pick the links — buying through them supports the
        battles at no extra cost to you.
      </p>

      {products.length === 0 && (
        <p className="mt-8 rounded-xl border border-edge bg-surface p-8 text-center text-smoke">
          The shop is being stocked — check back soon.
        </p>
      )}

      {CATEGORY_ORDER.map(({ key, label, sub }) => {
        const items = products.filter((p) => p.category === key);
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
        Disclosure: links on this page are affiliate links. Designer Kicks may
        earn a commission on qualifying purchases, at no additional cost to
        you. Prices shown are approximate and set by the merchant.
      </p>
    </div>
  );
}
