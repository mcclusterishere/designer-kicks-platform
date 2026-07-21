/**
 * The Designer Kicks → Heat Chart rebrand campaign — one landing page
 * per generated video asset, built for the $20 single-day Facebook buy
 * on the Designer Kicks page. Each variant carries its own ad copy so
 * A/B attribution is per-creative: the ad's URL is
 * /dk/{slug}?utm_content={slug} and every CTA on the page deep-links
 * into the funnel it advertises.
 *
 * Videos live on Higgsfield's CDN (generated from real app screenshots
 * in public/ad-refs/, which double as posters). The five face bumpers
 * from the earlier batch are intentionally NOT here — wrong identity
 * source, rejected.
 */

const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3G3F7jiUHPTPLSNf3XP0bAYtQmG";

export type DkVariant = {
  slug: string;
  name: string;
  video: string;
  poster: string | null;
  duration: string;
  headline: string;
  accent: string; // the word inside headline that gets the heat treatment
  sub: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string }[];
  fb: { primaryText: string; headline: string; description: string };
};

export const DK_VARIANTS: DkVariant[] = [
  {
    slug: "market",
    name: "The Market",
    video: `${CDN}/hf_20260721_213415_8219ffeb-c069-4f5e-9cdd-144df450bd91.mp4`,
    poster: "/ad-refs/market.png",
    duration: "6s",
    headline: "The stock market for custom sneakers.",
    accent: "stock market",
    sub: "Live bids on real one-of-ones. Asking prices, sell-now, and a Heat Index that moves when the culture does.",
    primary: { href: "/market", label: "See the Live Market" },
    secondary: [
      { href: "/register?ref=dk-market", label: "Create Free Account" },
      { href: "/catalog", label: "Browse the Catalog" },
    ],
    fb: {
      primaryText:
        "The stock market for custom sneakers is live. Real bids on real 1-of-1s, priced by the culture. Built by Designer Kicks.",
      headline: "The Heat Chart Is Live",
      description: "Free account. Bid, sell, collect.",
    },
  },
  {
    slug: "arena",
    name: "The Arena",
    video: `${CDN}/hf_20260721_213424_de7e88e7-30d2-4d56-8e43-3fb0a17cb45c.mp4`,
    poster: "/ad-refs/arena.png",
    duration: "6s",
    headline: "Sneakers battle. You crown the winner.",
    accent: "battle",
    sub: "Head-to-head customs, decided by community vote. Every vote moves the artist up the rankings and their prices with them.",
    primary: { href: "/battles", label: "Vote in a Battle" },
    secondary: [
      { href: "/register?ref=dk-arena", label: "Create Free Account" },
      { href: "/tournaments", label: "See the Tournaments" },
    ],
    fb: {
      primaryText:
        "Custom sneakers battle head-to-head. Your vote crowns the winner — and moves the market. Free to play.",
      headline: "Vote the Battle",
      description: "The arena for custom culture.",
    },
  },
  {
    slug: "heatlist",
    name: "The Heat List",
    video: `${CDN}/hf_20260721_213434_71fb44b4-38d4-4c07-a69c-e74eadf4fc69.mp4`,
    poster: "/ad-refs/heatlist.png",
    duration: "6s",
    headline: "Every artist ranked. One list. Real stakes.",
    accent: "ranked",
    sub: "Wins, votes, and verified sales feed the Heat List — the league table of custom-sneaker culture.",
    primary: { href: "/heat-list", label: "See the Rankings" },
    secondary: [
      { href: "/drafted", label: "Get Drafted to the League" },
      { href: "/register?ref=dk-heatlist", label: "Create Free Account" },
    ],
    fb: {
      primaryText:
        "Every customizer, ranked. Wins, votes, and real sales decide the Heat List. Where do you land?",
      headline: "See the Rankings",
      description: "The league table of custom culture.",
    },
  },
  {
    slug: "artist",
    name: "The Artist Closet",
    video: `${CDN}/hf_20260721_213443_bd25e005-62d2-4f61-8052-fe1c36006adb.mp4`,
    poster: "/ad-refs/artist.png",
    duration: "6s",
    headline: "Your closet is a portfolio now.",
    accent: "portfolio",
    sub: "Every piece priced, ranked, and holding a bid book — and when a piece resells, the artist gets paid again. Every time.",
    primary: { href: "/drafted", label: "Get Drafted" },
    secondary: [
      { href: "/sell", label: "Sell Your Customs" },
      { href: "/register?ref=dk-artist", label: "Create Free Account" },
    ],
    fb: {
      primaryText:
        "Customizers: price your work, build your bid book, and earn a royalty every time a piece resells. Get drafted.",
      headline: "Get Drafted",
      description: "Royalties on every resale.",
    },
  },
  {
    slug: "home",
    name: "The Home Page",
    video: `${CDN}/hf_20260721_213455_b9dcb529-faca-4eb8-a3da-ea765c971fac.mp4`,
    poster: "/ad-refs/home.png",
    duration: "6s",
    headline: "Designer Kicks grew into a league.",
    accent: "league",
    sub: "Same community, new arena. The Heat Chart: battles, bids, rankings, and a real market for one-of-one customs.",
    primary: { href: "/register?ref=dk-home", label: "Create Free Account" },
    secondary: [
      { href: "/market", label: "See the Market" },
      { href: "/story", label: "Read the Story" },
    ],
    fb: {
      primaryText:
        "Designer Kicks has a new home: The Heat Chart. Battles, bids, and rankings for custom-sneaker culture. Same community, bigger arena.",
      headline: "Join Free Today",
      description: "Designer Kicks × The Heat Chart.",
    },
  },
  {
    slug: "sting",
    name: "The Sting",
    video: `${CDN}/hf_20260721_212336_7c9c9ca9-b771-4e97-b5a5-158e0814ded0.mp4`,
    poster: null,
    duration: "4s",
    headline: "New name. Same culture.",
    accent: "culture",
    sub: "The Designer Kicks community built something bigger: a league where custom sneakers battle, rank, and trade like assets.",
    primary: { href: "/register?ref=dk-sting", label: "Create Free Account" },
    secondary: [
      { href: "/market", label: "See the Market" },
      { href: "/battles", label: "Watch a Battle" },
    ],
    fb: {
      primaryText:
        "New name. Same culture. Designer Kicks built The Heat Chart — where custom sneakers battle, rank, and trade.",
      headline: "The Heat Chart",
      description: "From the Designer Kicks community.",
    },
  },
];

export function getDkVariant(slug: string): DkVariant | undefined {
  return DK_VARIANTS.find((v) => v.slug === slug);
}

/** The one-line answer to "what is this?" — identical on every page. */
export const WHAT_IT_IS =
  "The Heat Chart is the stock market for custom sneakers — artists battle, fans vote, and one-of-one pieces get ranked, priced, and collected like assets.";

/** Benefit rows shared across all landing pages — one line per audience. */
export const AUDIENCE_BENEFITS = [
  {
    who: "Fans",
    line: "Vote in battles, bid on one-of-ones, own the pieces you crown.",
    cta: { href: "/battles", label: "Start voting" },
  },
  {
    who: "Customizers",
    line: "Get drafted, price your work, earn a royalty every time it resells.",
    cta: { href: "/drafted", label: "Get drafted" },
  },
  {
    who: "Collectors & Models",
    line: "Verified 1-of-1s with live market data — and free league shoots for models.",
    cta: { href: "/market", label: "Browse 1-of-1s" },
  },
];
