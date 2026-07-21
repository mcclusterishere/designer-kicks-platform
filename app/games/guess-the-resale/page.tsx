import Link from "next/link";
import { getGamePool } from "@/lib/games";
import GuessResale from "@/components/games/GuessResale";

export const metadata = {
  title: "Guess The Resale — Free Sneaker Price Game | The Heat Chart",
  description:
    "See a real sneaker, guess what it resells for. Closer the call, higher the score. Free to play on The Heat Chart — how sharp is your market eye?",
  openGraph: {
    title: "Guess The Resale — can you call the sneaker market?",
    description: "Real shoe, your price. Score points for how close you get. Free to play on The Heat Chart 🔥",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

export default async function GuessResalePage() {
  const pool = await getGamePool();

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-12">
      <div className="mb-5 text-center">
        <Link href="/games" className="tag text-smoke hover:text-white">← The Arcade</Link>
        <h1 className="display mt-2 text-3xl text-white">Guess The Resale</h1>
        <p className="mt-1 text-sm text-smoke">Five pairs. Call the price. Rack up points.</p>
      </div>

      {pool.length < 5 ? (
        <div className="rounded-3xl border border-edge bg-surface p-8 text-center">
          <p className="display text-2xl text-white">Deck&apos;s still loading</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-smoke">
            The catalog is stocking up with priced pairs. Check back soon — or
            go rate some heat.
          </p>
          <Link href="/rate" className="btn-hard-volt mt-5 inline-block rounded-xl px-6 py-3 tag font-bold">
            Rate The Heat →
          </Link>
        </div>
      ) : (
        <GuessResale pool={pool} />
      )}
    </div>
  );
}
