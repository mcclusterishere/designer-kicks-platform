/**
 * What makes a shoe worth arguing about.
 *
 * The site drifted into covering every release, which is the most
 * crowded content in sneakers and the reason it stopped feeling like
 * anything. Nobody argues about a general release sitting on shelves.
 * People argue about what they cannot get.
 *
 * So rarity, not category, is the filter. It happens to resolve the
 * customs-versus-OG question rather than pick a side: a one-of-one is
 * maximally rare by construction, a grail is rare because it is gone,
 * and a restock is neither. Both halves of the catalogue get held to the
 * same bar instead of competing for the same shelf.
 *
 * The signal is already in the data. We store what a shoe cost at retail
 * and what it trades for now, so the premium between them IS the
 * scarcity read, priced by the only people whose opinion is binding:
 * the ones actually paying.
 *
 * Deliberately NOT a model call and not a curated list. A number the
 * market sets, recomputed every time pricing refreshes, with no taste of
 * ours in it.
 */

export type RarityTier = "grail" | "heat" | "retail" | "shelf" | "unknown";

export type RarityRead = {
  tier: RarityTier;
  /** Market over retail. 3 means it trades at three times its sticker. */
  multiple: number | null;
  /** Percent over retail, the way the rest of the app already phrases it. */
  premiumPct: number | null;
  label: string;
};

/**
 * Where the lines sit. Product numbers, not physics, kept here so the
 * board, the deck and the importer cannot each invent their own.
 *
 * 2x is the honest floor for "hard to get". Below that a shoe is either
 * still buyable or only mildly resold, and calling it a grail on a site
 * whose whole pitch is scarcity is the fastest way to lose the people
 * who actually know.
 */
export const GRAIL_MULTIPLE = 3;
export const HEAT_MULTIPLE = 2;
/** Under this it is selling below sticker, which is the opposite of rare. */
export const SHELF_MULTIPLE = 0.95;

/** What each tier is called, once, so no surface renames a tier locally. */
export const TIER_LABEL: Record<RarityTier, string> = {
  grail: "Grail",
  heat: "Heat",
  retail: "Around retail",
  shelf: "Still on shelves",
  unknown: "Unpriced",
};

export type PricedShoe = {
  retailPriceCents?: number | null;
  marketPriceCents?: number | null;
  ebayNewCents?: number | null;
  ebayUsedCents?: number | null;
};

/**
 * The best live number we have. eBay is a real completed-sale signal, so
 * it stands in when the primary market price is missing rather than
 * letting a shoe fall to "unknown" for want of one field.
 */
export function livePriceCents(shoe: PricedShoe): number | null {
  const candidates = [shoe.marketPriceCents, shoe.ebayNewCents, shoe.ebayUsedCents];
  for (const c of candidates) if (c && c > 0) return c;
  return null;
}

export function rarityFor(shoe: PricedShoe): RarityRead {
  const retail = shoe.retailPriceCents ?? 0;
  const live = livePriceCents(shoe);
  // No retail to measure against, or nothing trading, means we do not
  // know. "unknown" is a real answer here and must never be dressed up
  // as a tier: a shoe with a missing field is not thereby a grail.
  if (retail <= 0 || !live) {
    return { tier: "unknown", multiple: null, premiumPct: null, label: TIER_LABEL.unknown };
  }
  const multiple = live / retail;
  const premiumPct = Math.round((multiple - 1) * 100);
  const tier: RarityTier =
    multiple >= GRAIL_MULTIPLE
      ? "grail"
      : multiple >= HEAT_MULTIPLE
        ? "heat"
        : multiple < SHELF_MULTIPLE
          ? "shelf"
          : "retail";
  return { tier, multiple, premiumPct, label: TIER_LABEL[tier] };
}

/** The bar for appearing anywhere the site presents scarcity. */
export const RARE_TIERS: RarityTier[] = ["grail", "heat"];

export function isRare(shoe: PricedShoe): boolean {
  return RARE_TIERS.includes(rarityFor(shoe).tier);
}

/**
 * The two columns we persist on every price write.
 *
 * SQL cannot divide one column by another inside a Prisma filter, so a
 * board that wants "rarest first, commoners hidden" either pulls the
 * whole table into memory or works off a stored number. It works off a
 * stored number. These are a pure function of retail and the live price
 * — never typed, never edited, rewritten every time either side moves —
 * so the column is a cache of rarityFor(), not a second opinion.
 */
export function rarityFields(shoe: PricedShoe): {
  rarityTier: RarityTier;
  rarityMultiple: number | null;
} {
  const r = rarityFor(shoe);
  return { rarityTier: r.tier, rarityMultiple: r.multiple };
}

export type RarityView = "all" | "rare" | "grail";

export function asRarityView(v: string | undefined | null): RarityView {
  const s = v?.trim().toLowerCase();
  return s === "rare" || s === "grail" ? s : "all";
}

/** Prisma where-clause off the persisted column. Exact, and it pages. */
export function rarityWhere(view: RarityView) {
  if (view === "grail") return { rarityTier: "grail" };
  if (view === "rare") return { rarityTier: { in: RARE_TIERS } };
  return {};
}

/** Sort helper for the handful of places that already hold rows in memory. */
export function byRarity(a: PricedShoe, b: PricedShoe): number {
  const ra = rarityFor(a).multiple ?? -1;
  const rb = rarityFor(b).multiple ?? -1;
  return rb - ra;
}

/** "3.4×" — the one phrasing, so every surface says it the same way. */
export function multipleLabel(multiple: number | null | undefined): string | null {
  if (!multiple || !Number.isFinite(multiple) || multiple <= 0) return null;
  return `${Math.round(multiple * 10) / 10}×`;
}
