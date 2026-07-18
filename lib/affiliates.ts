// The affiliate capture layer. Every outbound purchase link routes
// through /go, which (1) refuses to redirect anywhere but known
// merchants, (2) applies our affiliate tag the moment one is
// configured in env, and (3) logs the click. Truth about launches:
// SNKRS/Nike launch links never pay commission — the money is in the
// resale/retail merchants below. When an affiliate account gets
// approved, paste its tag into Railway and every existing link on the
// site upgrades itself. No code changes.

export type Merchant = {
  key: string;
  label: string;
  hosts: string[]; // hostname suffixes we'll redirect to
  /** Build a product-search URL for a shoe name / style code. */
  search?: (query: string) => string;
  /**
   * env var holding a tag template. "{url}" = encoded target,
   * "{plain}" = raw target. A template REPLACES the target URL
   * (impact-style deep links); a template starting with "&" or "?"
   * APPENDS params instead (eBay campid-style).
   */
  tagEnv?: string;
};

export const MERCHANTS: Merchant[] = [
  {
    key: "nike",
    label: "SNKRS",
    hosts: ["nike.com"],
    // No tagEnv on purpose: Nike launch links don't pay — this one is
    // for the fans, and the click still gets counted.
  },
  {
    key: "stockx",
    label: "StockX",
    hosts: ["stockx.com"],
    search: (q) => `https://stockx.com/search?s=${encodeURIComponent(q)}`,
    tagEnv: "AFF_STOCKX_TEMPLATE",
  },
  {
    key: "goat",
    label: "GOAT",
    hosts: ["goat.com"],
    search: (q) => `https://www.goat.com/search?query=${encodeURIComponent(q)}`,
    tagEnv: "AFF_GOAT_TEMPLATE",
  },
  {
    key: "ebay",
    label: "eBay",
    hosts: ["ebay.com"],
    search: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`,
    tagEnv: "AFF_EBAY_TEMPLATE",
  },
  {
    key: "kickscrew",
    label: "KicksCrew",
    hosts: ["kickscrew.com"],
    search: (q) => `https://www.kickscrew.com/search?q=${encodeURIComponent(q)}`,
    tagEnv: "AFF_KICKSCREW_TEMPLATE",
  },
  {
    key: "flightclub",
    label: "Flight Club",
    hosts: ["flightclub.com"],
    search: (q) => `https://www.flightclub.com/catalogsearch/result?query=${encodeURIComponent(q)}`,
    tagEnv: "AFF_FLIGHTCLUB_TEMPLATE",
  },
  { key: "footlocker", label: "Foot Locker", hosts: ["footlocker.com"], tagEnv: "AFF_FOOTLOCKER_TEMPLATE" },
  { key: "jdsports", label: "JD Sports", hosts: ["jdsports.com"], tagEnv: "AFF_JDSPORTS_TEMPLATE" },
  { key: "end", label: "END.", hosts: ["endclothing.com"], tagEnv: "AFF_END_TEMPLATE" },
  { key: "amazon", label: "Amazon", hosts: ["amazon.com"], tagEnv: "AFF_AMAZON_TEMPLATE" },
  { key: "angelus", label: "Angelus Direct", hosts: ["angelusdirect.com"], tagEnv: "AFF_ANGELUS_TEMPLATE" },
  { key: "reshoevn8r", label: "Reshoevn8r", hosts: ["reshoevn8r.com"], tagEnv: "AFF_RESHOEVN8R_TEMPLATE" },
  { key: "crep", label: "Crep Protect", hosts: ["crepprotect.com"], tagEnv: "AFF_CREP_TEMPLATE" },
  { key: "jasonmarkk", label: "Jason Markk", hosts: ["jasonmarkk.com"], tagEnv: "AFF_JASONMARKK_TEMPLATE" },
  { key: "lacelab", label: "Lace Lab", hosts: ["lacelab.com"], tagEnv: "AFF_LACELAB_TEMPLATE" },
  { key: "undefeated", label: "UNDEFEATED", hosts: ["undefeated.com"], tagEnv: "AFF_UNDEFEATED_TEMPLATE" },
];

export function merchantForUrl(url: string): Merchant | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return (
    MERCHANTS.find((m) =>
      m.hosts.some((h) => host === h || host.endsWith(`.${h}`))
    ) ?? null
  );
}

/** Apply the merchant's configured affiliate tag to a target URL. */
export function tagUrl(url: string, merchant: Merchant): string {
  const template = merchant.tagEnv ? process.env[merchant.tagEnv] : undefined;
  if (!template) return url;
  if (template.startsWith("&") || template.startsWith("?")) {
    const sep = url.includes("?") ? "&" : "?";
    return url + sep + template.replace(/^[&?]/, "");
  }
  return template
    .replace("{url}", encodeURIComponent(url))
    .replace("{plain}", url);
}

/** /go?u=… href for an outbound link, with on-site source attached. */
export function goHref(url: string, ref: string): string {
  return `/go?u=${encodeURIComponent(url)}&ref=${encodeURIComponent(ref)}`;
}

/**
 * The Where-to-Buy strip for a drop: SNKRS/raffle first (fans need
 * it), then the merchants that actually pay commission, deep-linked
 * to a search for this exact shoe.
 */
export function buyLinks(query: string, raffleUrl: string | null, ref: string) {
  const links: { label: string; href: string }[] = [];
  if (raffleUrl) {
    const m = merchantForUrl(raffleUrl);
    links.push({ label: m?.key === "nike" ? "SNKRS / Raffle" : "Raffle", href: goHref(raffleUrl, ref) });
  }
  for (const key of ["stockx", "goat", "ebay", "kickscrew"]) {
    const m = MERCHANTS.find((x) => x.key === key)!;
    if (m.search) links.push({ label: m.label, href: goHref(m.search(query), ref) });
  }
  return links;
}
