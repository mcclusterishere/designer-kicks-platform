import ScrollFilm, { type FilmScene } from "@/components/ScrollFilm";

export const metadata = {
  title: "The Film — How Designer Kicks Became The Heat Chart",
  description:
    "One scroll, the whole story: a blank pair, the culture that judges heat, the arena, the rankings, and the market where one-of-one customs trade like assets.",
  openGraph: {
    title: "The Heat Chart — The Film",
    description:
      "Scroll the story of the league: battles, rankings, and the stock market for custom sneakers.",
    type: "website",
  },
};

/**
 * The long ad. Every asset from the campaign — the premium cinematic
 * scenes and the screen-real product shots — sorted into one scrolling
 * story: the blank pair → the work → the culture judging → the arena
 * → the rankings → the watching → the market → the asset → the
 * portfolio → the league. Scenes with people show the league's
 * customizer character; the product scenes are the real app.
 */

const SCENES: FilmScene[] = [
  {
    src: "/ad-videos/sting.mp4",
    poster: "/ad-refs/sting.jpg",
    eyebrow: "Designer Kicks presents",
    headline: "The Heat Chart.",
    sub: "New name. Same culture. Scroll — this is the whole story.",
  },
  {
    src: "/ad-videos/unboxing.mp4",
    poster: "/ad-refs/unboxing.jpg",
    eyebrow: "Chapter I · The Blank",
    headline: "Every grail starts as a blank pair.",
    accent: "blank pair",
    sub: "Box-fresh white canvas, and a customizer who sees something in it nobody else does yet.",
  },
  {
    src: "/ad-videos/notforcheap.mp4",
    poster: "/ad-refs/notforcheap.jpg",
    eyebrow: "Chapter I · The Work",
    headline: "Hours of paint. One of one.",
    accent: "One of one",
    sub: "When it's finished there is exactly one on earth. That was never supposed to go for cheap.",
  },
  {
    src: "/ad-videos/verdict.mp4",
    poster: "/ad-refs/verdict.jpg",
    eyebrow: "Chapter II · The Culture",
    headline: "The block always knew how to judge heat.",
    accent: "judge heat",
    sub: "Two pairs on milk crates and a crowd calling the winner. The culture has been the referee forever.",
  },
  {
    src: "/ad-videos/arena.mp4",
    poster: "/ad-refs/arena.png",
    eyebrow: "Chapter II · The Arena",
    headline: "So we gave the culture an arena.",
    accent: "arena",
    sub: "Real customs, head-to-head, decided by community vote — every vote on the record.",
    ctas: [{ href: "/battles", label: "Vote in a Battle", hard: true }],
  },
  {
    src: "/ad-videos/heatlist.mp4",
    poster: "/ad-refs/heatlist.png",
    eyebrow: "Chapter II · The Rankings",
    headline: "Every win writes the rankings.",
    accent: "rankings",
    sub: "Wins, votes, verified sales — the Heat List is the league table nobody can buy their way up.",
    ctas: [{ href: "/heat-list", label: "See the Heat List" }],
  },
  {
    src: "/ad-videos/trader.mp4",
    poster: "/ad-refs/trader.jpg",
    eyebrow: "Chapter III · The Watching",
    headline: "People started watching it like a market.",
    accent: "market",
    sub: "Because when heat gets measured, it moves. And when it moves, it's worth something.",
  },
  {
    src: "/ad-videos/market.mp4",
    poster: "/ad-refs/market.png",
    eyebrow: "Chapter III · The Exchange",
    headline: "So we built the exchange.",
    accent: "exchange",
    sub: "Live bids, asking prices, sell-now — and a Heat Index ticking with the culture.",
    ctas: [{ href: "/market", label: "Open the Market", hard: true }],
  },
  {
    src: "/ad-videos/gallery.mp4",
    poster: "/ad-refs/gallery.jpg",
    eyebrow: "Chapter IV · The Asset",
    headline: "The work became an asset.",
    accent: "asset",
    sub: "Gallery-grade one-of-ones with provenance and standing bids — and a royalty back to the artist on every resale.",
  },
  {
    src: "/ad-videos/artist.mp4",
    poster: "/ad-refs/artist.png",
    eyebrow: "Chapter IV · The Portfolio",
    headline: "Your closet is a portfolio now.",
    accent: "portfolio",
    sub: "Every piece cataloged, ranked, and holding a bid book that pays the artist again. Every time.",
    ctas: [{ href: "/drafted", label: "Get Drafted" }],
  },
  {
    src: "/ad-videos/home.mp4",
    poster: "/ad-refs/home.png",
    eyebrow: "The League",
    headline: "Designer Kicks grew into this.",
    accent: "this",
    sub: "Battles. Rankings. A real market for one-of-one customs. Free to join — live right now.",
    ctas: [
      { href: "/register?ref=film", label: "Create Free Account", hard: true },
      { href: "/market", label: "Open the Market" },
    ],
  },
];

export default function FilmPage() {
  return <ScrollFilm scenes={SCENES} />;
}
