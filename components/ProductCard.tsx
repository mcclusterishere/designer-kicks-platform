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
      className={`card-lift group flex flex-col overflow-hidden rounded-xl border bg-surface ${
        product.featured ? "border-volt/50" : "border-edge"
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
          <div
            className="flex h-full w-full items-center justify-center p-4"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, rgba(200,255,0,0.05) 0 14px, transparent 14px 28px)",
            }}
          >
            <span className="display -rotate-3 border-2 border-smoke/40 px-3 py-1.5 text-center text-2xl text-smoke/80">
              {product.merchant}
            </span>
          </div>
        )}
        {product.featured && (
          <span className="sticker absolute left-2 top-2 px-2 py-0.5 text-sm">
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
