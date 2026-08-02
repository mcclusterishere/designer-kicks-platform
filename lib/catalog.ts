import { prisma } from "./db";
import { GRAIL_MULTIPLE, HEAT_MULTIPLE, SHELF_MULTIPLE, rarityFor } from "./rarity";

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
  // Decimals are always dollars; whole numbers under 5000 read as dollars
  // (a $5,000+ retail is rarer than a provider already sending cents).
  if (typeof v === "string" && v.includes(".")) return Math.round(n * 100);
  if (!Number.isInteger(n)) return Math.round(n * 100);
  return Math.round(n < 5000 ? n * 100 : n);
}

/**
 * The live number — what the pair actually trades for. Providers spread
 * it across many shapes: top-level avg/min/max, a nested market object,
 * or per-size variants each carrying a lowest ask. Take the first that
 * sticks; avg beats min so one hammered size doesn't set the price.
 */
function digMarketCents(row: Row): number | null {
  const flat = toCents(
    row["avg_price"] ?? row["avgPrice"] ?? row["average_price"] ??
    row["min_price"] ?? row["minPrice"] ?? row["lowest_ask"] ?? row["lowestAsk"] ??
    row["last_sale"] ?? row["lastSale"] ?? row["market_price"] ?? row["marketPrice"]
  );
  if (flat) return flat;
  const market = row["market"];
  if (market && typeof market === "object") {
    const m = market as Row;
    const nested = toCents(m["avg_price"] ?? m["averageDeadstockPrice"] ?? m["lowestAsk"] ?? m["lastSale"]);
    if (nested) return nested;
  }
  const variants = row["variants"];
  if (Array.isArray(variants) && variants.length > 0) {
    const asks = variants
      .map((v) => (v && typeof v === "object" ? toCents((v as Row)["lowest_ask"] ?? (v as Row)["lowestAsk"] ?? (v as Row)["price"]) : null))
      .filter((n): n is number => n !== null);
    if (asks.length > 0) return Math.min(...asks);
  }
  return null;
}

/** StockX-style traits array: [{trait: "Retail Price", value: 170}, …]. */
function digTrait(row: Row, names: string[]): unknown {
  const traits = row["traits"];
  if (!Array.isArray(traits)) return null;
  for (const t of traits) {
    if (!t || typeof t !== "object") continue;
    const label = s((t as Row)["trait"] ?? (t as Row)["name"])?.toLowerCase();
    if (label && names.includes(label)) return (t as Row)["value"];
  }
  return null;
}

function toDate(v: unknown): Date | null {
  const str = s(v);
  if (!str) return null;
  const d = new Date(/^\d{10,13}$/.test(str) ? Number(str.padEnd(13, "0")) : str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Which shopping lane a pair belongs to, read off the product name the way
 * the industry actually writes it: "Wmns" / "(W)" / "Women's" for women's
 * pairs, "(GS)" / "(PS)" / "(TD)" / "Little Kids" etc. for kids. Anything
 * unmarked is a men's/unisex release — that's the retail convention.
 */
export function genderFromName(name: string | null): "mens" | "womens" | "kids" {
  if (!name) return "mens";
  if (/\b(?:GS|PS|TD|BG|BP|BT|GG)\b|\(GS\)|\(PS\)|\(TD\)|toddler|infant|little kids?|big kids?|younger kids?|older kids?|\bkids\b|\byouth\b|preschool|grade school/i.test(name)) return "kids";
  if (/\bwmns\b|\(w\)|\bwomen'?s?\b|\(women'?s?\)/i.test(name)) return "womens";
  return "mens";
}

const LANES = new Set(["men", "mens", "women", "womens", "kids", "youth", "child", "children", "unisex", "gs", "ps", "td", "infant", "toddler", "preschool"]);

/** Normalize a provider's gender field to our three lanes; null if unusable. */
function laneFromProvider(v: string | null): "mens" | "womens" | "kids" | null {
  const g = v?.trim().toLowerCase();
  if (!g || !LANES.has(g)) return null;
  if (g.startsWith("women")) return "womens";
  if (g === "men" || g === "mens" || g === "unisex") return "mens";
  return "kids";
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
  /** Rows that landed with a live market price — if this stays 0 while
   *  seen climbs, the provider's price fields changed shape on us. */
  priced: number;
  /** Rows dropped for being commoners: trading at or under sticker. */
  skipped: number;
  /** Rows that landed with a retail price — the other leg of the spread.
   *  seen climbing while this stays 0 = the provider's slim list payload
   *  is holding retail back and the display hints aren't being honored. */
  retailPriced: number;
  error?: string;
};

/**
 * Pull a page-run of products from KicksDB into the catalog. Tolerant of
 * response-shape drift: rows can live at data/products/results/root and
 * fields under several names. Upserts by SKU so re-imports refresh.
 */
export async function importFromKicksDB(
  query: string,
  pages = 1,
  opts: { rareOnly?: boolean } = {}
): Promise<ImportResult> {
  // Default ON. The whole point of the filter is that somebody has to
  // deliberately ask for the commoners, not deliberately exclude them.
  const rareOnly = opts.rareOnly !== false;
  const key = process.env.KICKSDB_KEY;
  if (!key) return { ok: false, imported: 0, updated: 0, seen: 0, priced: 0, retailPriced: 0, skipped: 0, error: "Add KICKSDB_KEY first — the catalog imports through KicksDB." };
  const base = process.env.KICKSDB_API_URL || "https://api.kicks.dev";

  let imported = 0, updated = 0, seen = 0, priced = 0, retailPriced = 0, skipped = 0;
  for (let page = 1; page <= Math.min(pages, 10); page++) {
    let json: unknown;
    try {
      // the display hints ask for the heavy fields the slim list omits —
      // traits carry "Retail Price", variants carry per-size asks. A
      // provider that doesn't know the params ignores them harmlessly.
      const res = await fetch(
        `${base}/v3/stockx/products?query=${encodeURIComponent(query)}&limit=50&page=${page}` +
          `&display[traits]=true&display[variants]=true`,
        { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000) }
      );
      if (res.status === 429) return { ok: seen > 0, imported, updated, seen, priced, retailPriced, skipped, error: "Rate-limited by KicksDB — try again in a minute (what landed so far was saved)." };
      if (!res.ok) return { ok: seen > 0, imported, updated, seen, priced, retailPriced, skipped, error: `KicksDB answered ${res.status} — check the key/plan.` };
      json = await res.json();
    } catch {
      return { ok: seen > 0, imported, updated, seen, priced, retailPriced, skipped, error: "Couldn't reach KicksDB — network hiccup, run it again." };
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
      const marketPriceCents = digMarketCents(row);
      const data = {
        name,
        brand,
        silhouette: dig(row, ["silhouette", "model", "series"]) ?? guessSilhouette(name, brand),
        colorway: dig(row, ["colorway", "color", "colorName"]) ?? s(digTrait(row, ["colorway"])),
        imageUrl: dig(row, ["image", "imageUrl", "thumbnail", "media", "smallImageUrl"]),
        retailPriceCents: toCents(
          row["retailPrice"] ?? row["retail_price"] ?? row["retail_price_cents"] ??
          row["retailPriceCents"] ?? row["retail"] ?? row["price"] ?? row["msrp"] ??
          digTrait(row, ["retail price", "retail", "retail price (usd)"])
        ),
        marketPriceCents,
        releaseDate: toDate(
          row["releaseDate"] ?? row["release_date"] ?? row["releaseDateISO"] ??
          digTrait(row, ["release date", "released"])
        ),
        gender: laneFromProvider(dig(row, ["gender", "gender_type", "category"])) ?? genderFromName(name),
        source: "kicksdb",
      };
      if (marketPriceCents) priced++;
      if (data.retailPriceCents) retailPriced++;

      const existing = await prisma.catalogShoe.findUnique({
        where: { sku },
        select: {
          id: true,
          retailPriceCents: true,
          marketPriceCents: true,
          ebayNewCents: true,
          ebayUsedCents: true,
        },
      });
      // A re-import may ADD knowledge, never erase it: a slim provider
      // response (null price/colorway/image) must not clobber a value a
      // richer earlier import already landed. Nulls drop out of the
      // update; the create keeps them so the row shape stays complete.
      const gained = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
      ) as Partial<typeof data>;

      // Rarity is read off the row as it will EXIST after this write, not
      // off the payload in hand. A slim response carrying a market price
      // but no retail is still a grail if we already knew the retail —
      // judging the payload alone would file it as "unknown" and, under
      // rareOnly, throw it away for arriving incomplete.
      const rarity = rarityFor({ ...(existing ?? {}), ...gained });

      // Commoners do not get a seat. The site is about shoes that are
      // hard to get, and a general release trading at or under its
      // sticker is the exact opposite of that — importing thousands of
      // them is what made the catalogue look like everybody else's.
      //
      // Two deliberate narrowings. Only shoes we can CONFIRM are common
      // get refused: a row with no price yet is unproven, not innocent,
      // since pricing arrives later on the eBay refresh and discarding it
      // now means never finding out. And a pair already in the base is
      // always refreshed — the gate decides what the catalogue ADMITS,
      // never what it is allowed to know, and a shoe frozen at last
      // year's price can never be seen to have spiked.
      if (rareOnly && !existing && (rarity.tier === "shelf" || rarity.tier === "retail")) {
        skipped++;
        continue;
      }
      const rarityData = { rarityTier: rarity.tier, rarityMultiple: rarity.multiple };
      await prisma.catalogShoe.upsert({
        where: { sku },
        update: { ...gained, ...rarityData },
        create: { sku, ...data, ...rarityData },
      });
      existing ? updated++ : imported++;
    }
    if (rows.length < 50) break; // last page
  }
  return { ok: true, imported, updated, seen, priced, retailPriced, skipped };
}

export type CatalogMatch = {
  sku: string;
  name: string;
  brand: string | null;
  colorway: string | null;
  imageUrl: string | null;
  retailPriceCents: number | null;
  marketPriceCents: number | null;
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
    select: { sku: true, name: true, brand: true, colorway: true, imageUrl: true, retailPriceCents: true, marketPriceCents: true },
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

export type RefreshSummary = {
  ok: boolean;
  brands: { brand: string; imported: number; updated: number; seen: number; priced: number; skipped: number; error?: string }[];
  error?: string;
};

/**
 * Scheduled price/lane refresher. Each run re-imports a few brands from
 * the provider — market prices, photos, and lanes all update on the
 * upsert. Brands rotate deterministically by day, so over a week or two
 * the whole base cycles through without ever hammering the rate limit.
 */
export async function refreshCatalogPricing(brandsPerRun = 3, pages = 2): Promise<RefreshSummary> {
  if (!catalogConfigured()) return { ok: false, brands: [], error: "Dormant — no KICKSDB_KEY." };
  const groups = await prisma.catalogShoe.groupBy({ by: ["brand"], where: { brand: { not: null } } });
  const all = groups.map((g) => g.brand!).sort();
  if (all.length === 0) return { ok: true, brands: [] };

  const day = Math.floor(Date.now() / 86_400_000);
  const start = (day * brandsPerRun) % all.length;
  const picks = Array.from({ length: Math.min(brandsPerRun, all.length) }, (_, i) => all[(start + i) % all.length]);

  const brands: RefreshSummary["brands"] = [];
  for (const brand of picks) {
    const r = await importFromKicksDB(brand, pages);
    brands.push({ brand, imported: r.imported, updated: r.updated, seen: r.seen, priced: r.priced, skipped: r.skipped, error: r.error });
    if (!r.ok) break; // rate-limited or provider down — let tomorrow's run continue
  }
  // Prices just moved, so the cached tiers are stale for every row this
  // run touched — and for any row an older import left without one.
  await recomputeRarity().catch(() => 0);
  return { ok: true, brands };
}

/**
 * Every brand in one run, not the day's three.
 *
 * The scheduled refresher above rotates brands by day so it never hammers
 * the provider. That rotation is keyed on the calendar, which means running
 * it twice in an afternoon re-fetches the exact same three brands — correct
 * for a nightly job, useless as a "refresh the database" button. This walks
 * the whole brand list instead.
 *
 * It stops on a provider error rather than grinding through a rate limit,
 * and it reports exactly how far it got: a sweep that covered 9 of 30 brands
 * says so, because a partial sweep reported as a full one is worse than no
 * sweep at all.
 */
export async function sweepAllBrands(
  pages = 2,
  budgetMs = 210_000
): Promise<RefreshSummary & { covered: number; ofBrands: number; stoppedEarly: string | null }> {
  if (!catalogConfigured()) {
    return { ok: false, brands: [], covered: 0, ofBrands: 0, stoppedEarly: null, error: "Dormant — no KICKSDB_KEY." };
  }
  const groups = await prisma.catalogShoe.groupBy({ by: ["brand"], where: { brand: { not: null } } });
  const all = groups.map((g) => g.brand!).sort();

  const started = Date.now();
  const brands: RefreshSummary["brands"] = [];
  let stoppedEarly: string | null = null;

  for (const brand of all) {
    if (Date.now() - started > budgetMs) {
      stoppedEarly = "ran out of time budget";
      break;
    }
    const r = await importFromKicksDB(brand, pages);
    brands.push({ brand, imported: r.imported, updated: r.updated, seen: r.seen, priced: r.priced, skipped: r.skipped, error: r.error });
    if (!r.ok) {
      stoppedEarly = r.error ?? "provider error";
      break;
    }
  }
  await recomputeRarity().catch(() => 0);
  return { ok: true, brands, covered: brands.length, ofBrands: all.length, stoppedEarly };
}

/**
 * Recompute the cached scarcity columns across the whole base.
 *
 * The importer and the eBay sync each write these on the rows they touch,
 * which covers everything going forward and nothing that landed before
 * the columns existed. This is the backfill, and it is also the repair
 * for the day somebody moves a threshold: the tiers are a cache, so the
 * only honest thing to do when the definition changes is rebuild it.
 *
 * One statement rather than a read-modify-write per row, because the base
 * runs to five figures and the arithmetic is something Postgres can do
 * without ever sending a row to Node. It is `Unsafe` only in the sense
 * that the SQL is assembled as a string — every value interpolated is a
 * module constant coerced through Number(), so there is no input here for
 * anything to be injected through.
 *
 * The WHERE clause is what keeps this cheap to call on a schedule: rows
 * whose tier and multiple already agree with the arithmetic are left
 * alone, so a second run in the same hour rewrites nothing.
 */
export async function recomputeRarity(): Promise<number> {
  // GREATEST(x, 0) then NULLIF mirrors rarityFor()'s "> 0" tests: a zero
  // or negative price is absence, not a data point.
  const pos = (col: string) => `NULLIF(GREATEST("${col}", 0), 0)`;
  const live = `COALESCE(${pos("marketPriceCents")}, ${pos("ebayNewCents")}, ${pos("ebayUsedCents")})`;
  const mult = `(${live}::float8 / ${pos("retailPriceCents")})`;
  // Thresholds come from lib/rarity.ts so SQL and TypeScript cannot drift
  // into two different definitions of "grail".
  const g = Number(GRAIL_MULTIPLE);
  const h = Number(HEAT_MULTIPLE);
  const s = Number(SHELF_MULTIPLE);
  const tier = `CASE
      WHEN ${mult} IS NULL THEN 'unknown'
      WHEN ${mult} >= ${g} THEN 'grail'
      WHEN ${mult} >= ${h} THEN 'heat'
      WHEN ${mult} <  ${s} THEN 'shelf'
      ELSE 'retail'
    END`;
  return prisma.$executeRawUnsafe(
    `UPDATE "CatalogShoe"
        SET "rarityMultiple" = ${mult},
            "rarityTier" = ${tier}
      WHERE "rarityMultiple" IS DISTINCT FROM ${mult}
         OR "rarityTier" IS DISTINCT FROM ${tier}`
  );
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
