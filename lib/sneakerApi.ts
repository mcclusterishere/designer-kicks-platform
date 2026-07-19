/**
 * Sneaker release-date + SKU lookup — the "get the free SKUs and the
 * release dates" pipeline.
 *
 * Design (per the plan we mapped out):
 *  - A waterfall of providers, tried in order until one answers:
 *        KicksDB  →  RapidAPI StockX  →  Apify
 *    Each provider is gated on its own API key. With no keys set the
 *    whole thing is DORMANT — no outbound calls, nothing breaks — so the
 *    site ships today for $0 and lights up the moment a free key lands in
 *    the environment.
 *  - Always key by SKU / style code (e.g. "DZ5485-612"), never by name.
 *    "Pink Thunder" and "Thunder Pink" would fork into duplicate rows.
 *  - Free tiers throttle hard (StockX free ≈ 15 requests/day, 1 req/sec).
 *    Callers space requests out; a 429 just falls through to the next
 *    provider instead of throwing the whole run.
 *  - Source authority ranks who is allowed to overwrite a date. A human
 *    (manual) outranks every API; SNKRS outranks the resale scrapers.
 *
 * Env (all optional — set the ones you have):
 *   KICKSDB_KEY            KicksDB API key
 *   KICKSDB_API_URL        base URL (default https://api.kicks.dev)
 *   RAPIDAPI_STOCKX_KEY    RapidAPI key for the stockx5 host
 *   RAPIDAPI_STOCKX_HOST   host (default stockx5.p.rapidapi.com)
 *   APIFY_TOKEN            Apify token
 *   APIFY_SNEAKER_ACTOR    actor id (default dev00~sneaker-database-api)
 */

export type DropSource =
  | "manual"
  | "SNKRS"
  | "RapidAPI_StockX"
  | "KicksDB"
  | "Apify";

/** Higher wins. A date may only be overwritten by an equal-or-higher source. */
export const SOURCE_AUTHORITY: Record<string, number> = {
  manual: 100, // a human set it — never let a scraper stomp it
  SNKRS: 90, // Nike's own calendar is ground truth
  RapidAPI_StockX: 70,
  KicksDB: 60,
  Apify: 40,
  boutique: 20,
};

export function authorityOf(source: string | null | undefined): number {
  if (!source) return 0;
  return SOURCE_AUTHORITY[source] ?? 10; // unknown source beats "no source" but loses to all named ones
}

export type SneakerHit = {
  source: DropSource;
  sku: string | null;
  name: string | null;
  releaseDate: Date | null;
  image: string | null;
  retailPriceCents: number | null;
};

/** Which providers have keys in the environment right now. */
export function providersConfigured(): { kicksdb: boolean; stockx: boolean; apify: boolean } {
  return {
    kicksdb: Boolean(process.env.KICKSDB_KEY),
    stockx: Boolean(process.env.RAPIDAPI_STOCKX_KEY),
    apify: Boolean(process.env.APIFY_TOKEN),
  };
}

/** True when at least one provider can be called. */
export function sneakerApiLive(): boolean {
  const p = providersConfigured();
  return p.kicksdb || p.stockx || p.apify;
}

// A provider signalled it can't help — RATE_LIMIT (429), NO_KEY (unset),
// or FAILED (network / not-found). The waterfall catches these and moves on.
class ProviderError extends Error {
  constructor(public reason: "RATE_LIMIT" | "NO_KEY" | "FAILED", msg?: string) {
    super(msg ?? reason);
  }
}

const TIMEOUT_MS = 8000;

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ProviderError("FAILED", "network error");
  }
  if (res.status === 429) throw new ProviderError("RATE_LIMIT");
  if (!res.ok) throw new ProviderError("FAILED", `HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new ProviderError("FAILED", "bad JSON");
  }
}

// --- Defensive extractors -------------------------------------------------
// Every provider names its fields a little differently and reshapes its
// payloads without warning. Rather than hard-code one schema, we dig for
// the values across the shapes these APIs are known to use.

function firstProduct(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return (data[0] as Record<string, unknown>) ?? null;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["Products", "products", "data", "results", "hits", "items"]) {
      const arr = o[k];
      if (Array.isArray(arr) && arr.length) return arr[0] as Record<string, unknown>;
    }
    // Some endpoints return the single product object directly.
    if (o.sku || o.styleId || o.style_id || o.releaseDate || o.release_date) return o;
  }
  return null;
}

function digString(obj: Record<string, unknown> | null, keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  // one level into a nested "traits" / "attributes" bag
  for (const bag of ["traits", "attributes", "productAttributes"]) {
    const inner = obj[bag];
    if (inner && typeof inner === "object") {
      const hit = digString(inner as Record<string, unknown>, keys);
      if (hit) return hit;
    }
  }
  return null;
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toHit(source: DropSource, data: unknown): SneakerHit {
  const p = firstProduct(data);
  const priceStr = digString(p, ["retailPrice", "retail_price", "retailPriceCents"]);
  const priceNum = priceStr ? Number(priceStr.replace(/[^0-9.]/g, "")) : NaN;
  return {
    source,
    sku: digString(p, ["sku", "styleId", "style_id", "styleID", "productId"]),
    name: digString(p, ["name", "title", "shoeName", "productName"]),
    releaseDate: parseDate(
      digString(p, ["releaseDate", "release_date", "releaseDateISO", "releaseDateUnix", "dropDate"])
    ),
    image: digString(p, ["image", "imageUrl", "thumbnail", "media", "smallImageUrl"]),
    retailPriceCents:
      Number.isFinite(priceNum) && priceNum > 0
        ? Math.round(priceNum < 1000 ? priceNum * 100 : priceNum) // dollars → cents (heuristic)
        : null,
  };
}

// --- Providers ------------------------------------------------------------

async function fromKicksDB(query: string): Promise<SneakerHit> {
  const key = process.env.KICKSDB_KEY;
  if (!key) throw new ProviderError("NO_KEY");
  const base = process.env.KICKSDB_API_URL || "https://api.kicks.dev";
  const data = await getJson(
    `${base}/v3/stockx/products?query=${encodeURIComponent(query)}&limit=1`,
    { headers: { Authorization: `Bearer ${key}` } }
  );
  const hit = toHit("KicksDB", data);
  if (!hit.releaseDate && !hit.sku) throw new ProviderError("FAILED", "no match");
  return hit;
}

async function fromRapidStockX(query: string): Promise<SneakerHit> {
  const key = process.env.RAPIDAPI_STOCKX_KEY;
  if (!key) throw new ProviderError("NO_KEY");
  const host = process.env.RAPIDAPI_STOCKX_HOST || "stockx5.p.rapidapi.com";
  const data = await getJson(`https://${host}/search?q=${encodeURIComponent(query)}`, {
    headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": host },
  });
  const hit = toHit("RapidAPI_StockX", data);
  if (!hit.releaseDate && !hit.sku) throw new ProviderError("FAILED", "no match");
  return hit;
}

async function fromApify(query: string): Promise<SneakerHit> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new ProviderError("NO_KEY");
  const actor = process.env.APIFY_SNEAKER_ACTOR || "dev00~sneaker-database-api";
  // Apify actors run async; run-sync-get-dataset-items waits and hands
  // back the scraped dataset in the same request.
  let res: Response;
  try {
    res = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, limit: 1, currency: "usd" }),
        signal: AbortSignal.timeout(TIMEOUT_MS * 3), // scrapes are slower
      }
    );
  } catch {
    throw new ProviderError("FAILED", "network error");
  }
  if (res.status === 429) throw new ProviderError("RATE_LIMIT");
  if (!res.ok) throw new ProviderError("FAILED", `HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  const hit = toHit("Apify", data);
  if (!hit.releaseDate && !hit.sku) throw new ProviderError("FAILED", "no match");
  return hit;
}

// --- The waterfall --------------------------------------------------------

/**
 * Resolve a shoe (by SKU, ideally) across the provider waterfall. Returns
 * the first provider that answers, or null if every provider is unset,
 * throttled, or empty-handed.
 */
export async function lookupSneaker(query: string): Promise<SneakerHit | null> {
  const q = query.trim();
  if (!q) return null;
  const chain: Array<(s: string) => Promise<SneakerHit>> = [
    fromKicksDB,
    fromRapidStockX,
    fromApify,
  ];
  for (const provider of chain) {
    try {
      return await provider(q);
    } catch (e) {
      if (e instanceof ProviderError && e.reason === "NO_KEY") continue; // provider not set up
      // RATE_LIMIT or FAILED — try the next provider in the chain
      continue;
    }
  }
  return null;
}

/** Just the release date + which source vouched for it. */
export async function getReleaseDate(
  sku: string
): Promise<{ source: DropSource; releaseDate: Date } | null> {
  const hit = await lookupSneaker(sku);
  if (hit?.releaseDate) return { source: hit.source, releaseDate: hit.releaseDate };
  return null;
}

/** Discover a SKU (and its data) from a shoe name — the "get the SKUs" side. */
export async function findSku(name: string): Promise<SneakerHit | null> {
  const hit = await lookupSneaker(name);
  return hit?.sku ? hit : hit ?? null;
}
