const CATEGORY_LABELS: Record<string, string> = {
  marketplace: "Marketplace",
  retail: "Retail",
  customization: "Custom Supplies",
  cleaning: "Care & Cleaning",
  accessories: "Accessories",
};

type Props = {
  product: {
    id: string;
    name: string;
    merchant: string;
    category: string;
    blurb: string | null;
    price: string | null;
    imageUrl: string | null;
    affiliateUrl: string;
    featured: boolean;
  };
};

export default function ProductCard({ product }: Props) {
  return (
    <a
      href={product.affiliateUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group flex flex-col overflow-hidden rounded-xl border bg-surface transition hover:-translate-y-0.5 ${
        product.featured ? "border-volt/50" : "border-edge hover:border-volt/40"
      }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-panel">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="display text-3xl text-edge">{product.merchant}</span>
          </div>
        )}
        {product.featured && (
          <span className="absolute left-2 top-2 rounded bg-volt px-1.5 py-0.5 tag font-bold text-ink">
            Hot
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="tag text-smoke">
          {CATEGORY_LABELS[product.category] ?? product.category} · {product.merchant}
        </p>
        <h3 className="mt-1 font-bold text-white">{product.name}</h3>
        {product.blurb && (
          <p className="mt-1 line-clamp-2 text-sm text-smoke">{product.blurb}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-mono text-sm text-volt">{product.price ?? ""}</span>
          <span className="tag text-white group-hover:text-volt">Shop →</span>
        </div>
      </div>
    </a>
  );
}
