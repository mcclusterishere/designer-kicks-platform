/**
 * The platforms artists sell on. One catalog powers three surfaces:
 *  - the Studio "where you sell" manager (label + input hint),
 *  - the public artist page "shop their work" buttons (label),
 *  - the /sell educational portal (blurb + our referral link).
 *
 * Referral links: set REF_<PLATFORM>_URL in the environment to your
 * affiliate/referral sign-up URL and the portal button uses it; otherwise
 * it falls back to the platform's plain sign-up page. So the portal ships
 * useful today and starts paying the moment a referral link lands in env.
 */
export type SellPlatform = {
  key: string;
  label: string;
  hint?: string; // placeholder for the URL field
  blurb?: string; // portal one-liner
  refEnv?: string; // env var holding our referral sign-up URL
  signupUrl?: string; // fallback sign-up page (no referral)
};

export const SELL_PLATFORMS: SellPlatform[] = [
  { key: "ebay", label: "eBay", hint: "https://www.ebay.com/usr/yourstore",
    blurb: "The biggest resale audience on earth. Great for one-off customs and grails.",
    refEnv: "REF_EBAY_URL", signupUrl: "https://www.ebay.com/sl/sell" },
  { key: "shopify", label: "Shopify", hint: "https://yourbrand.myshopify.com",
    blurb: "Your own storefront and brand — no marketplace fees eating every sale.",
    refEnv: "REF_SHOPIFY_URL", signupUrl: "https://www.shopify.com/free-trial" },
  { key: "etsy", label: "Etsy", hint: "https://www.etsy.com/shop/yourshop",
    blurb: "Handmade-first buyers who expect and pay for custom work.",
    refEnv: "REF_ETSY_URL", signupUrl: "https://www.etsy.com/sell" },
  { key: "depop", label: "Depop", hint: "https://www.depop.com/yourhandle",
    blurb: "Gen-Z streetwear crowd, social and fast. Perfect for drops.",
    refEnv: "REF_DEPOP_URL", signupUrl: "https://www.depop.com" },
  { key: "grailed", label: "Grailed", hint: "https://www.grailed.com/yourhandle",
    blurb: "Menswear and hype heads who know what a custom is worth.",
    refEnv: "REF_GRAILED_URL", signupUrl: "https://www.grailed.com/sell" },
  { key: "mercari", label: "Mercari", hint: "https://www.mercari.com/u/yourid",
    blurb: "Simple, low-friction resale — a solid second channel.",
    refEnv: "REF_MERCARI_URL", signupUrl: "https://www.mercari.com" },
  { key: "stockx", label: "StockX", hint: "https://stockx.com/…",
    blurb: "Authenticated marketplace — best for verified retro pairs you flip.",
    refEnv: "REF_STOCKX_URL", signupUrl: "https://stockx.com/sell" },
  { key: "goat", label: "GOAT", hint: "https://www.goat.com/…",
    blurb: "Sneaker-first resale with a huge mobile audience.",
    refEnv: "REF_GOAT_URL", signupUrl: "https://www.goat.com/sell" },
  { key: "instagram", label: "Instagram", hint: "https://instagram.com/yourhandle",
    blurb: "Where the culture already is. DMs close more custom sales than any checkout.",
    signupUrl: "https://instagram.com" },
  { key: "website", label: "Own website", hint: "https://yourbrand.com",
    blurb: "Own the whole thing. We'll help you point people to it.",
    signupUrl: "https://www.shopify.com/free-trial" },
  { key: "other", label: "Other", hint: "https://…",
    blurb: "Selling somewhere else? Add it — we surface wherever your buyers are." },
];

const BY_KEY = new Map(SELL_PLATFORMS.map((p) => [p.key, p]));

export function platformLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key;
}

/** Our referral sign-up URL for a platform, or its plain sign-up page. */
export function referralUrl(p: SellPlatform): string {
  if (p.refEnv && process.env[p.refEnv]) return process.env[p.refEnv] as string;
  return p.signupUrl ?? "#";
}

export function referralConfigured(p: SellPlatform): boolean {
  return Boolean(p.refEnv && process.env[p.refEnv]);
}
