// Piece categories — one source of truth so apparel and accessories
// read as what they are everywhere, instead of defaulting to shoe-speak.
//
// These are also the league's CATEGORY WALLS: every piece lives in
// exactly one lane and never battles outside it — hats don't face
// shoes, vests don't face hats, chains don't face either. Enforced at
// every point a matchup is created: admin battles, call-outs, and
// tournament seeding.
export const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
  sneakers: { emoji: "👟", label: "Sneakers" },
  apparel: { emoji: "🧥", label: "Apparel" },
  headwear: { emoji: "🧢", label: "Headwear" },
  accessories: { emoji: "⛓️", label: "Accessories" },
};

export const PIECE_CATEGORY_KEYS = Object.keys(CATEGORY_META);

export function isPieceCategory(v: string): boolean {
  return v in CATEGORY_META;
}

export function categoryEmoji(category: string): string {
  return CATEGORY_META[category]?.emoji ?? "🎨";
}

export function categoryLabel(category: string): string {
  return CATEGORY_META[category]?.label ?? category;
}
