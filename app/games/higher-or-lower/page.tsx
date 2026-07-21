import Link from "next/link";
import { getGamePool } from "@/lib/games";
import HigherLower from "@/components/games/HigherLower";

export const metadata = {
  title: "Higher or Lower — Free Sneaker Resale Game | The Heat Chart",
  description:
    "Two sneakers, one call: does it resell higher or lower? Build the longest streak you can. Free to play on The Heat Chart, on real market data.",
  openGraph: {
    title: "Higher or Lower — how long can your sneaker streak go?",
    description: "Two pairs, one call — higher or lower resale? Build the streak. Free to play on The Heat Chart 🔥",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

export default async function HigherLowerPage() {
  const pool = await getGamePool();

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-12">
      <div className="mb-5 text-center">
        <Link href="/games" className="tag text-smoke hover:text-white">← The Arcade</Link>
        <h1 className="display mt-2 text-3xl text-white">Higher or Lower</h1>
        <p className="mt-1 text-sm text-smoke">Call the resale. Keep the streak alive.</p>
      </div>

      {pool.length < 2 ? (
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
        <HigherLower pool={pool} />
      )}
    </div>
  );
}
