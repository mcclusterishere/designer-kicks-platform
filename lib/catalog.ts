import { prisma } from "./db";

/**
 * The shoe knowledge base — bulk import real retail sneakers so customs
 * and content can be matched to affiliate offers by real SKU.
 *
 * Provider: KicksDB (kicks.dev) — same key as the drop-date waterfall
 * (KICKSDB_KEY), so one paid plan powers both. Dormant without the key.
 * KICKSDB_API_URL overrides the endpoint (tests use a local mock).
 */

export function catalogConfigured(): boolean {
  return Boolean(process.env.KICKSDB_KEY);
}

type Row = Record<string, unknown>;

const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function dig(row: Row, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    const got = s(v);
    if (got) return got;
  }
  return null;
}

function toCents(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n < 1000 ? n * 100 : n); // dollars vs already-cents heuristic
}

function toDate(v: unknown): Date | null {
  const str = s(v);
  if (!str) return null;
  const d = new Date(/^\d{10,13}$/.test(str) ? Number(str.padEnd(13, "0")) : str);
  return isNaN(d.getTime()) ? null : d;
}

/** Guess the silhouette from a product name ("Air Jordan 11 Retro Bred" → "Air Jordan 11"). */
function guessSilhouette(name: string | null, brand: string | null): string | null {
  if (!name) return null;
  const m = name.match(
    /((?:Air )?Jordan \d+|Air Force 1|Air Max \d+\w*|Dunk (?:Low|High|Mid)|Yeezy(?: Boost)? \d+(?: V\d)?|New Balance \d+\w*|Blazer (?:Low|Mid|High)|Gel-\w+|Ultraboost|Samba|Gazelle|Campus|Forum (?:Low|High)|Old Skool|Sk8-Hi|Chuck (?:70|Taylor))/i
  );
  if (m) return m[1];
  const words = name.split(/\s+/);
  return words.slice(0, Math.min(3, words.length)).join(" ") || brand;
}

export type ImportResult = {
  ok: boolean;
  imported: number;
  updated: number;
  seen: number;
  error?: string;
};

/**
 * Pull a page-run of products from KicksDB into the catalog. Tolerant of
 * response-shape drift: rows can live at data/products/results/root and
 * fields under several names. Upserts by SKU so re-imports refresh.
 */
export async function importFromKicksDB(query: string, pages = 1): Promise<ImportResult> {
  const key = process.env.KICKSDB_KEY;
  if (!key) return { ok: false, imported: 0, updated: 0, seen: 0, error: "Add KICKSDB_KEY first — the catalog imports through KicksDB." };
  const base = process.env.KICKSDB_API_URL || "https://api.kicks.dev";

  let imported = 0, updated = 0, seen = 0;
  for (let page = 1; page <= Math.min(pages, 10); page++) {
    let json: unknown;
    try {
      const res = await fetch(
        `${base}/v3/stockx/products?query=${encodeURIComponent(query)}&limit=50&page=${page}`,
        { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000) }
      );
      if (res.status === 429) return { ok: seen > 0, imported, updated, seen, error: "Rate-limited by KicksDB — try again in a minute (what landed so far was saved)." };
      if (!res.ok) return { ok: seen > 0, imported, updated, seen, error: `KicksDB answered ${res.status} — check the key/plan.` };
      json = await res.json();
    } catch {
      return { ok: seen > 0, imported, updated, seen, error: "Couldn't reach KicksDB — network hiccup, run it again." };
    }

    const o = (json ?? {}) as Row;
    const rows: Row[] = Array.isArray(json)
      ? (json as Row[])
      : ((o.data ?? o.products ?? o.results ?? []) as Row[]);
    if (!Array.isArray(rows) || rows.length === 0) break; // ran out of pages

    for (const row of rows) {
      const sku = dig(row, ["sku", "styleId", "style_id", "styleID", "pid"]);
      const name = dig(row, ["title", "name", "shoeName", "productName"]);
      if (!sku || !name) continue;
      seen++;
      const brand = dig(row, ["brand", "brandName"]);
      const data = {
        name,
        brand,
        silhouette: dig(row, ["silhouette", "model", "series"]) ?? guessSilhouette(name, brand),
        colorway: dig(row, ["colorway", "color", "colorName"]),
        imageUrl: dig(row, ["image", "imageUrl", "thumbnail", "media", "smallImageUrl"]),
        retailPriceCents: toCents(row["retailPrice"] ?? row["retail_price"] ?? row["price"] ?? row["msrp"]),
        releaseDate: toDate(row["releaseDate"] ?? row["release_date"] ?? row["releaseDateISO"]),
        source: "kicksdb",
      };
      const existing = await prisma.catalogShoe.findUnique({ where: { sku }, select: { id: true } });
      await prisma.catalogShoe.upsert({ where: { sku }, update: data, create: { sku, ...data } });
      existing ? updated++ : imported++;
    }
    if (rows.length < 50) break; // last page
  }
  return { ok: true, imported, updated, seen };
}

export type CatalogMatch = {
  sku: string;
  name: string;
  brand: string | null;
  colorway: string | null;
  imageUrl: string | null;
  retailPriceCents: number | null;
};

/**
 * Match a custom's donor shoe to a real catalog SKU. Silhouette (or the
 * free-text base shoe) narrows, colorway breaks ties. Best-effort — a
 * null match just means the buy links fall back to name search.
 */
export async function matchDonorShoe(input: {
  silhouette?: string | null;
  baseShoe?: string | null;
  brand?: string | null;
  baseColorway?: string | null;
}): Promise<CatalogMatch | null> {
  const model = input.silhouette?.trim() || input.baseShoe?.trim();
  if (!model) return null;
  const candidates = await prisma.catalogShoe.findMany({
    where: {
      name: { contains: model, mode: "insensitive" },
      ...(input.brand ? { brand: { equals: input.brand, mode: "insensitive" } } : {}),
    },
    take: 40,
    select: { sku: true, name: true, brand: true, colorway: true, imageUrl: true, retailPriceCents: true },
  });
  if (candidates.length === 0) return null;
  const cw = input.baseColorway?.toLowerCase().replace(/["']/g, "");
  if (cw) {
    const exact = candidates.find(
      (c) => c.colorway?.toLowerCase().includes(cw) || c.name.toLowerCase().includes(cw)
    );
    if (exact) return exact;
  }
  return candidates[0];
}

/** Panel numbers: how big the base is and how well customs resolve to it. */
export async function catalogStats() {
  const [total, brands, sampled] = await Promise.all([
    prisma.catalogShoe.count(),
    prisma.catalogShoe.groupBy({ by: ["brand"], _count: true, orderBy: { _count: { brand: "desc" } }, take: 6 }),
    prisma.catalogShoe.findMany({ orderBy: { updatedAt: "desc" }, take: 5, select: { sku: true, name: true } }),
  ]);
  return {
    total,
    brands: brands.map((b) => ({ name: b.brand ?? "unknown", count: b._count })),
    latest: sampled,
  };
}
