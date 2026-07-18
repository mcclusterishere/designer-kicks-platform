// Piece categories — one source of truth so apparel and accessories
// read as what they are everywhere, instead of defaulting to shoe-speak.
export const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
  sneakers: { emoji: "👟", label: "Sneakers" },
  apparel: { emoji: "🧥", label: "Apparel" },
  accessories: { emoji: "🧢", label: "Accessories" },
};

export function categoryEmoji(category: string): string {
  return CATEGORY_META[category]?.emoji ?? "🎨";
}

export function categoryLabel(category: string): string {
  return CATEGORY_META[category]?.label ?? category;
}
