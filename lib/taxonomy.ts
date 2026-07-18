// The taxonomy under every custom: brand (the maker), silhouette (the
// model), and base colorway (what the donor pair was before the work).
// Artists can state these outright; for older pieces we derive brand +
// silhouette from the free-text baseShoe so the taste engine never
// runs on empty columns.

export const BRANDS = [
  "Jordan",
  "Nike",
  "adidas",
  "New Balance",
  "Asics",
  "Vans",
  "Converse",
  "Reebok",
  "Puma",
  "Crocs",
  "Timberland",
  "UGG",
  "Other",
] as const;

type Parsed = { brand: string | null; silhouette: string | null };

// Ordered: more specific patterns first (Jordan before Nike, SB Dunk
// before Dunk). Matched case-insensitively against baseShoe.
const RULES: Array<{ match: RegExp; brand: string; silhouette?: string }> = [
  { match: /jordan\s*(\d+)/, brand: "Jordan" },
  { match: /\baj\s*(\d+)/, brand: "Jordan" },
  { match: /jumpman|jordan/, brand: "Jordan" },
  { match: /sb\s*dunk/, brand: "Nike", silhouette: "Nike SB Dunk" },
  { match: /dunk/, brand: "Nike", silhouette: "Nike Dunk" },
  { match: /air\s*force\s*1|af1/, brand: "Nike", silhouette: "Air Force 1" },
  { match: /air\s*max\s*(\d+)?/, brand: "Nike", silhouette: "Air Max" },
  { match: /blazer/, brand: "Nike", silhouette: "Nike Blazer" },
  { match: /nike/, brand: "Nike" },
  { match: /yeezy|foam\s*runner/, brand: "adidas", silhouette: "Yeezy" },
  { match: /samba|gazelle|campus|superstar|forum|ultraboost|nmd/, brand: "adidas" },
  { match: /adidas/, brand: "adidas" },
  { match: /new\s*balance|\b(550|990|991|992|993|2002r|9060)\b/, brand: "New Balance" },
  { match: /asics|gel[-\s]/, brand: "Asics" },
  { match: /vans|old\s*skool|sk8/, brand: "Vans" },
  { match: /converse|chuck|all\s*star/, brand: "Converse" },
  { match: /reebok|club\s*c|question/, brand: "Reebok" },
  { match: /puma|suede\s*classic/, brand: "Puma" },
  { match: /crocs|clog/, brand: "Crocs" },
  { match: /timberland|timb/, brand: "Timberland" },
  { match: /ugg/, brand: "UGG" },
];

/** Best-effort brand + silhouette from a free-text base shoe. */
export function parseBaseShoe(baseShoe: string | null | undefined): Parsed {
  const text = (baseShoe ?? "").toLowerCase();
  if (!text) return { brand: null, silhouette: null };
  for (const rule of RULES) {
    const m = text.match(rule.match);
    if (!m) continue;
    if (rule.brand === "Jordan") {
      const num = m[1] ?? text.match(/\b(\d{1,2})s?\b/)?.[1];
      return { brand: "Jordan", silhouette: num ? `Air Jordan ${num}` : "Air Jordan" };
    }
    return { brand: rule.brand, silhouette: rule.silhouette ?? titleCase(baseShoe ?? "") };
  }
  return { brand: null, silhouette: baseShoe ? titleCase(baseShoe) : null };
}

function titleCase(s: string) {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * The resolved taxonomy for a piece: stated fields win, parsed
 * baseShoe fills the gaps. Everything downstream (taste profiles,
 * pulse analytics) goes through this so old pieces still count.
 */
export function pieceTaxonomy(piece: {
  brand?: string | null;
  silhouette?: string | null;
  baseColorway?: string | null;
  baseShoe?: string | null;
  category?: string | null;
}): { brand: string | null; silhouette: string | null; colorway: string | null } {
  if (piece.category && piece.category !== "sneakers") {
    // Apparel/accessories: brand still applies, silhouettes don't.
    return { brand: piece.brand ?? null, silhouette: null, colorway: piece.baseColorway ?? null };
  }
  const parsed = parseBaseShoe(piece.baseShoe);
  return {
    brand: piece.brand ?? parsed.brand,
    silhouette: piece.silhouette ?? parsed.silhouette,
    colorway: piece.baseColorway ?? null,
  };
}
