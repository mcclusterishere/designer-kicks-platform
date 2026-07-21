import { siteUrl } from "@/lib/articles";

export const metadata = {
  title: "Developers — The Heat Chart Public API",
  description:
    "Pull The Heat Chart's data straight into your product: the customizer roster, one-of-one customs with artist pricing, the customs market index, and OG releases with live premiums. Free with attribution.",
};

const ENDPOINTS = [
  {
    path: "/api/v1/artists",
    what: "The customizer roster",
    fields: "slug, name, city, instagram, bio, piece count, profile URL",
    params: "?limit= ?offset=",
  },
  {
    path: "/api/v1/customs",
    what: "Every approved one-of-one piece",
    fields:
      "title, artist + collaborators, category, base item (brand/silhouette/colorway), size, story, images, video, ask / last sale / top open offer",
    params: "?category=sneakers|apparel|accessories ?artist=slug ?limit= ?offset=",
  },
  {
    path: "/api/v1/market",
    what: "The customs pricing index",
    fields: "index stats (volume, sales, average, verified) + the full board with asks, last two sales, and open offers",
    params: "—",
  },
  {
    path: "/api/v1/catalog",
    what: "OG retail releases, priced live",
    fields: "SKU, name, brand, colorway, retail, market value, premium %, release date, lane",
    params: "?brand= ?q= ?limit= ?offset=",
  },
];

export default function DevelopersPage() {
  const base = siteUrl();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="tag text-volt">Public API</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Our database, published
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-smoke">
        KicksDB has retail. StockX has resale.{" "}
        <span className="text-white">Nobody else has customs.</span> The Heat
        Chart&apos;s API is the only structured feed of one-of-one custom
        pieces, the artists behind them, and what the culture actually pays —
        plus our own live-priced OG catalog. Read-only, CORS-open, free to
        use with attribution.
      </p>

      <div className="mt-8 rounded-xl border border-edge bg-surface p-5">
        <p className="tag text-smoke">Try it right now</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-ink p-4 text-xs leading-relaxed text-emerald-400">
          {`curl ${base}/api/v1/customs?limit=5`}
        </pre>
        <p className="mt-2 text-xs text-smoke">
          Start at <code className="text-white">{base}/api/v1</code> — the index
          describes every endpoint.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {ENDPOINTS.map((e) => (
          <div key={e.path} className="rounded-xl border border-edge bg-surface p-5">
            <p className="font-mono text-sm font-bold text-volt">GET {e.path}</p>
            <p className="mt-1 text-sm font-semibold text-white">{e.what}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-smoke">{e.fields}</p>
            {e.params !== "—" && (
              <p className="mt-1.5 font-mono text-[11px] text-smoke/80">{e.params}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-volt/40 bg-volt/5 p-5 text-sm leading-relaxed text-smoke">
        <p className="tag text-volt">The rules</p>
        <ul className="mt-2 space-y-1.5">
          <li>• <span className="text-white">Attribution required</span> — credit The Heat Chart and link theheatchart.com wherever the data shows.</li>
          <li>• 120 requests/minute per IP. Responses cache for 5 minutes — poll accordingly.</li>
          <li>• Read-only. Prices are informational, not quotes.</li>
          <li>• Building something bigger on it (an aggregator, a pricing product)? Reach the administration — data partnerships are open.</li>
        </ul>
      </div>
    </div>
  );
}
