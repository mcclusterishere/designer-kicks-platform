import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "The Arcade — Free Sneaker Games | The Heat Chart",
  description:
    "Guess the resale, call it higher or lower, rate the heat, run the Culture IQ gauntlet. Free sneaker games on real market data — no download, just play.",
  openGraph: {
    title: "The Arcade — Free Sneaker Games | The Heat Chart",
    description:
      "Guess resale prices, call it higher or lower, rate the heat. Free to play, built on real sneaker market data. How high can you score?",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

const GAMES = [
  {
    href: "/games/guess-the-resale",
    emoji: "💸",
    title: "Guess The Resale",
    blurb: "Real shoe, your price. How close can you call the market?",
    tone: "volt" as const,
  },
  {
    href: "/games/higher-or-lower",
    emoji: "📈",
    title: "Higher or Lower",
    blurb: "Two pairs. Which one resells for more? Build the streak.",
    tone: "heat" as const,
  },
  {
    href: "/rate",
    emoji: "🔥",
    title: "Rate The Heat",
    blurb: "Score customs and real drops. Build your taste profile.",
    tone: "volt" as const,
  },
  {
    href: "/quiz",
    emoji: "🧠",
    title: "Culture IQ",
    blurb: "The sneaker-knowledge gauntlet. Prove you know.",
    tone: "heat" as const,
  },
];

export default async function ArcadePage() {
  const shoeCount = await prisma.catalogShoe.count({ where: { imageUrl: { not: null } } });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="text-center">
        <p className="tag text-heat">The Heat Chart · Free to play</p>
        <h1 className="display mt-2 text-5xl text-white">The <span className="text-gradient-volt">Arcade</span></h1>
        <p className="mx-auto mt-3 max-w-md text-smoke">
          Sneaker games built on real market data{shoeCount > 0 && <> — {shoeCount.toLocaleString()} pairs in the deck</>}.
          No download. Beat your friends, share your score.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {GAMES.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="card-lift group rounded-2xl border border-edge bg-surface p-6 transition hover:border-volt/50"
          >
            <div className="text-4xl">{g.emoji}</div>
            <h2 className={`display mt-3 text-2xl ${g.tone === "volt" ? "text-white" : "text-white"} group-hover:text-volt`}>
              {g.title}
            </h2>
            <p className="mt-1 text-sm text-smoke">{g.blurb}</p>
            <p className={`mt-4 tag font-bold ${g.tone === "volt" ? "text-volt" : "text-heat"}`}>
              Play →
            </p>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-smoke">
        New pairs cycle in as the catalog updates.{" "}
        <Link href="/catalog" className="text-volt underline">Browse the whole shoe database →</Link>
      </p>
    </div>
  );
}
