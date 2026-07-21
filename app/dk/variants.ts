/**
 * The Designer Kicks → Heat Chart rebrand campaign — one landing page
 * per generated video asset, built for the $20 single-day Facebook buy
 * on the Designer Kicks page. Each variant carries its own ad copy so
 * A/B attribution is per-creative: the ad's URL is
 * /dk/{slug}?utm_content={slug} and every CTA on the page deep-links
 * into the funnel it advertises.
 *
 * Videos are SELF-HOSTED in public/ad-videos (pulled off Higgsfield's
 * CDN once by .github/workflows/fetch-ad-videos.yml) — hotlinking
 * their CDN didn't play outside their app. Posters are the real app
 * screenshots in public/ad-refs/. The five face bumpers from the
 * earlier batch are intentionally NOT here — wrong identity source,
 * rejected.
 */

export type DkBeat = {
  at: number; // seconds into the video where this moment starts
  time: string;
  title: string;
  text: string;
  cta?: { href: string; label: string };
};

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
  /** The ad, explained shot by shot — what's on screen and how to go do it. */
  beats: DkBeat[];
};

export const DK_VARIANTS: DkVariant[] = [
  {
    slug: "market",
    name: "The Market",
    video: "/ad-videos/market.mp4",
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
    beats: [
      {
        at: 0,
        time: "0:00",
        title: "The Live Board",
        text: "That's the real Market screen — one-of-one customs with real asking prices, set by the artists who painted them. Not stock photos: pieces that exist, priced to move.",
        cta: { href: "/market", label: "Open the Live Board" },
      },
      {
        at: 2,
        time: "0:02",
        title: "The numbers that pulse",
        text: "The green arrow and the HX number are the Heat Index — every vote, bid, and sale pushes a piece's number up like a live ticker. The culture literally moves the price.",
        cta: { href: "/market", label: "Watch a piece's HX move" },
      },
      {
        at: 4,
        time: "0:04",
        title: "The red CUSTOMS pill",
        text: "That glowing switch flips the board between two worlds: CUSTOMS (the one-of-one market) and OG DROPS (retail heat with live spreads). Day and night, one tap.",
        cta: { href: "/market", label: "Flip the switch yourself" },
      },
    ],
  },
  {
    slug: "arena",
    name: "The Arena",
    video: "/ad-videos/arena.mp4",
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
    beats: [
      {
        at: 0,
        time: "0:00",
        title: "The matchups",
        text: "That's the Arena — real customs paired head-to-head like fight cards. Two pieces, one winner, decided by the community's votes.",
        cta: { href: "/battles", label: "See tonight's card" },
      },
      {
        at: 2,
        time: "0:02",
        title: "The scroll",
        text: "Every card you scroll past is a live battle. Fans pick winners; winners climb. This is the engine the whole league runs on.",
        cta: { href: "/battles", label: "Scroll the live battles" },
      },
      {
        at: 4,
        time: "0:04",
        title: "The red pulse",
        text: "That heartbeat glow on the vote button? That's a vote landing. Votes push artists up the Heat List and push their prices with them — your tap literally moves the market.",
        cta: { href: "/register?ref=dk-arena", label: "Cast your first vote" },
      },
    ],
  },
  {
    slug: "heatlist",
    name: "The Heat List",
    video: "/ad-videos/heatlist.mp4",
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
    beats: [
      {
        at: 0,
        time: "0:00",
        title: "The league table",
        text: "That's the Heat List — every artist in the league, ranked. Battle wins, fan votes, and verified sales feed the number next to each name. Nobody buys a spot.",
        cta: { href: "/heat-list", label: "See the full rankings" },
      },
      {
        at: 2,
        time: "0:02",
        title: "The climb",
        text: "The upward scroll is what a season feels like: win a battle, move up a row. The flames beside the top names mean their heat is live right now.",
        cta: { href: "/battles", label: "Watch a battle decide it" },
      },
      {
        at: 4,
        time: "0:04",
        title: "The glowing top row",
        text: "That red lift at the top is the #1 seat taking the crown. Somebody holds it today. If you customize, it's waiting for you to come take it.",
        cta: { href: "/drafted", label: "Get drafted and climb" },
      },
    ],
  },
  {
    slug: "artist",
    name: "The Artist Closet",
    video: "/ad-videos/artist.mp4",
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
    beats: [
      {
        at: 0,
        time: "0:00",
        title: "An artist's closet",
        text: "That's a real artist page — every piece they've built, cataloged like a portfolio. This is what your work looks like when it's treated as a body of work, not a camera roll.",
        cta: { href: "/artists", label: "Browse the roster" },
      },
      {
        at: 2,
        time: "0:02",
        title: "The badge glint",
        text: "That flash on the piece card is a heat-rank badge — earned in battles and votes, never bought. Collectors read those badges the way buyers read a certificate.",
        cta: { href: "/battles", label: "See badges get earned" },
      },
      {
        at: 4,
        time: "0:04",
        title: "The green pulse",
        text: "That soft green line is a standing bid — real money waiting on the piece. And when a piece resells later, the artist gets paid again. Every time.",
        cta: { href: "/drafted", label: "Get your closet started" },
      },
    ],
  },
  {
    slug: "home",
    name: "The Home Page",
    video: "/ad-videos/home.mp4",
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
    beats: [
      {
        at: 0,
        time: "0:00",
        title: "The front door",
        text: "That serif wordmark with HEAT in red is the new home. This is where the Designer Kicks community landed — a full league, not a page.",
        cta: { href: "/", label: "Walk in the front door" },
      },
      {
        at: 2,
        time: "0:02",
        title: "The first scroll",
        text: "The drift upward is the feed opening up: battles to vote, drops to catch, pieces to bid on — one scroll, all of it live.",
        cta: { href: "/market", label: "Scroll the real thing" },
      },
      {
        at: 4,
        time: "0:04",
        title: "The light sweep",
        text: "That pass of light across the name is the grand-opening moment. The league is live now — and the account is free.",
        cta: { href: "/register?ref=dk-home", label: "Claim your free account" },
      },
    ],
  },
  {
    slug: "sting",
    name: "The Sting",
    video: "/ad-videos/sting.mp4",
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
    beats: [
      {
        at: 0,
        time: "0:00",
        title: "Black, then the name",
        text: "No product shot, no pitch — just the name arriving out of the dark in fashion-cover serif, HEAT in signal red. A marque, the way houses announce themselves.",
        cta: { href: "/story", label: "Why the name changed" },
      },
      {
        at: 1.5,
        time: "0:01",
        title: "The heat shimmer",
        text: "The warp rising off the letters is heat off summer asphalt — the culture's temperature made visible. That's the whole product in one image: we measure heat.",
        cta: { href: "/market", label: "See heat measured live" },
      },
      {
        at: 3,
        time: "0:03",
        title: "The single ember",
        text: "One spark drifting up. One-of-one — every piece on the platform is the only one on earth. That's what gets ranked, priced, and collected here.",
        cta: { href: "/register?ref=dk-sting", label: "Join the league free" },
      },
    ],
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
