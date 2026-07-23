import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";


import RateDeck from "@/components/RateDeck";
import { buildRateDeck } from "@/lib/rateDeck";


export const metadata = {
  title: "Rate the Heat — Score Designs Out of 5 | The Heat Chart",
  description:
    "One custom at a time, five flames on the table. Rate designs, reveal what the culture scored, and build your taste profile.",
};
export const dynamic = "force-dynamic";

export default async function RatePage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
        <div className="rounded-3xl border border-edge bg-surface/80 p-8 text-center shadow-2xl">
          <h1 className="display text-3xl text-white">
            Rate The Heat
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-smoke">
            One design at a time. Five flames on the table. Score it,
            then see what the culture said — and watch the chart learn
            your taste.
          </p>
          <div className="mt-6 grid gap-2">
            <Link href="/register" className="btn-hard block rounded-xl py-3 tag font-bold">
              Create A Free Account
            </Link>
            <Link href="/signin" className="btn-hard-volt block rounded-xl py-3 tag font-bold">
              Sign In To Play
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const userId = session.user.id;
  // The deck is ENDLESS now — this is just the opening hand; the
  // client re-deals through moreRateCards() as it runs low.
  const [cards, ratedBefore, ratedRetail] = await Promise.all([
    buildRateDeck(userId),
    prisma.designRating.count({ where: { userId } }),
    prisma.catalogRating.count({ where: { userId } }),
  ]);

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-12">
      <div className="mb-5 text-center">
        <h1 className="display text-3xl text-white">
          Rate The Heat
        </h1>
        <p className="mt-1 text-sm text-smoke">
          {ratedBefore + ratedRetail > 0
            ? `${ratedBefore + ratedRetail} rated so far — your taste profile is watching.`
            : "Customs and real drops, five flames each. Your taste profile starts now."}
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-3xl border border-volt/40 bg-surface/80 p-8 text-center shadow-2xl">
          <h2 className="display text-2xl text-white">You&apos;ve Rated Everything</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-smoke">
            Fresh designs land as artists submit — come back after the
            next drop, or go settle some battles.
          </p>
          <div className="mt-6 grid gap-2">
            <Link href="/profile#taste" className="btn-hard block rounded-xl py-3 tag font-bold">
              See Your Taste Profile
            </Link>
            <Link href="/battles" className="btn-hard-volt block rounded-xl py-3 tag font-bold">
              Back To The Arena
            </Link>
          </div>
        </div>
      ) : (
        <RateDeck cards={cards} ratedBefore={ratedBefore} />
      )}
    </div>
  );
}
