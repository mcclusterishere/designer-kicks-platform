import { matchDonorShoe } from "@/lib/catalog";
import { buyLinks } from "@/lib/affiliates";

/**
 * "Shop the base pair" — the affiliate module under a custom. Resolves the
 * donor shoe to a real catalog SKU (KicksDB) for exact-match buy links and
 * a real retail price; falls back to a name search when the catalog has no
 * match yet, so it earns from day one and sharpens as the catalog fills.
 * All links route through /go (tracked, tagged, nofollow+sponsored).
 */
export default async function DonorShoe({
  brand,
  silhouette,
  baseShoe,
  baseColorway,
  refTag,
  compact = false,
}: {
  brand?: string | null;
  silhouette?: string | null;
  baseShoe?: string | null;
  baseColorway?: string | null;
  refTag: string;
  compact?: boolean;
}) {
  const match = await matchDonorShoe({ brand, silhouette, baseShoe, baseColorway }).catch(() => null);
  const query = match?.sku || silhouette || baseShoe;
  if (!query) return null;

  const links = buyLinks(query, null, refTag);
  if (links.length === 0) return null;

  const modelName = match?.name || silhouette || baseShoe;
  const retail = match?.retailPriceCents ? `$${Math.round(match.retailPriceCents / 100)}` : null;

  return (
    <div className={`rounded-lg border border-edge bg-panel/40 p-3 ${compact ? "mt-3" : "mt-4"}`}>
      <p className="tag text-smoke">
        Shop the base pair{retail && <span> · retail {retail}</span>}
      </p>
      {!compact && modelName && <p className="mt-0.5 text-sm font-bold text-white">{modelName}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="tag rounded-md border border-volt/40 px-2.5 py-1 text-volt transition hover:border-volt hover:bg-volt/10"
          >
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}
