/**
 * eBay Browse API — the used-market leg of the spread, auto-matched.
 *
 * Nobody uploads anything by hand: the sync walks the catalog, searches
 * eBay for each pair, and stores the median live price for NEW and
 * USED listings. With EBAY_CAMPAIGN_ID set (eBay Partner Network),
 * every item link the API hands back is affiliate-tagged, so the same
 * data that powers the spread also earns the ambassador commission.
 *
 * Dormant until keys exist — same pattern as KicksDB/Gemini/Meta:
 *   EBAY_CLIENT_ID + EBAY_CLIENT_SECRET  (app keys, client-credentials)
 *   EBAY_CAMPAIGN_ID                     (optional, EPN affiliate tag)
 *   EBAY_API_URL                         (test override)
 */

const EBAY_API = process.env.EBAY_API_URL || "https://api.ebay.com";

export function ebayConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

// Client-credentials token, cached until shortly before expiry.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function ebayToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
  const res = await fetch(`${EBAY_API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || `eBay token ${res.status}`);
  }
  cachedToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 7200) * 1000 };
  return cachedToken.token;
}

type BrowseItem = {
  price?: { value?: string; currency?: string };
  condition?: string;
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
};

function medianCents(items: BrowseItem[]): number | null {
  const cents = items
    .map((i) => Number(i.price?.value))
    .filter((v) => Number.isFinite(v) && v > 0)
    .map((v) => Math.round(v * 100))
    .sort((a, b) => a - b);
  if (cents.length === 0) return null;
  return cents[Math.floor(cents.length / 2)];
}

export type EbayPrices = {
  newCents: number | null;
  usedCents: number | null;
  sampleUrl: string | null; // affiliate-tagged when EPN campaign is set
};

/**
 * Live median prices for a pair, new and used. One Browse search per
 * condition, sneaker category, US marketplace, sorted by price so the
 * median reflects the realistic middle of the market.
 */
export async function searchEbayPrices(query: string): Promise<EbayPrices> {
  if (!ebayConfigured()) return { newCents: null, usedCents: null, sampleUrl: null };
  const token = await ebayToken();

  async function search(conditions: string): Promise<BrowseItem[]> {
    const params = new URLSearchParams({
      q: query,
      category_ids: "15709", // Athletic Shoes
      filter: `conditions:{${conditions}},priceCurrency:USD`,
      limit: "25",
      sort: "price",
    });
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    };
    // EPN affiliate context: makes itemAffiliateWebUrl come back tagged.
    if (process.env.EBAY_CAMPAIGN_ID) {
      headers["X-EBAY-C-ENDUSERCTX"] = `affiliateCampaignId=${process.env.EBAY_CAMPAIGN_ID}`;
    }
    const res = await fetch(`${EBAY_API}/buy/browse/v1/item_summary/search?${params}`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as { itemSummaries?: BrowseItem[] };
    if (!res.ok) return [];
    return json.itemSummaries ?? [];
  }

  const [newItems, usedItems] = await Promise.all([search("NEW"), search("USED")]);
  const sample = newItems[0] ?? usedItems[0] ?? null;
  return {
    newCents: medianCents(newItems),
    usedCents: medianCents(usedItems),
    sampleUrl: sample?.itemAffiliateWebUrl ?? sample?.itemWebUrl ?? null,
  };
}

/**
 * The auto-matcher: walks the catalog oldest-checked-first and pulls
 * fresh eBay medians. Called from the daily catalog cron — the whole
 * base stays matched with zero manual uploads. A run is capped so one
 * cron tick never hammers the API; the rotation covers everything
 * across days.
 */
export async function syncEbayPrices(limit = 40): Promise<{
  configured: boolean;
  checked: number;
  matched: number;
}> {
  if (!ebayConfigured()) return { configured: false, checked: 0, matched: 0 };
  const { prisma } = await import("./db");

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const shoes = await prisma.catalogShoe.findMany({
    where: { OR: [{ ebayCheckedAt: null }, { ebayCheckedAt: { lt: weekAgo } }] },
    orderBy: [{ ebayCheckedAt: { sort: "asc", nulls: "first" } }],
    take: limit,
    select: { id: true, name: true },
  });

  let matched = 0;
  for (const shoe of shoes) {
    try {
      const prices = await searchEbayPrices(shoe.name);
      await prisma.catalogShoe.update({
        where: { id: shoe.id },
        data: {
          ebayNewCents: prices.newCents,
          ebayUsedCents: prices.usedCents,
          ebayCheckedAt: new Date(),
        },
      });
      if (prices.newCents || prices.usedCents) matched++;
    } catch {
      // One bad match never stops the rotation.
      await prisma.catalogShoe.update({
        where: { id: shoe.id },
        data: { ebayCheckedAt: new Date() },
      });
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { configured: true, checked: shoes.length, matched };
}
