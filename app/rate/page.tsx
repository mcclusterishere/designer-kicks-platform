import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { pieceTaxonomy } from "@/lib/taxonomy";
import { categoryLabel } from "@/lib/categories";
import RateDeck, { type RateCard } from "@/components/RateDeck";

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
  const [rawPool, ratedBefore] = await Promise.all([
    prisma.submission.findMany({
      where: {
        status: "APPROVED",
        ratings: { none: { userId } },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { artist: { select: { slug: true, displayName: true, userId: true } } },
    }),
    prisma.designRating.count({ where: { userId } }),
  ]);
  // No rating your own work or your own closet — filtered here because
  // SQL NOT on nullable columns silently drops the NULL rows.
  const pool = rawPool.filter((s) => s.ownerId !== userId && s.artist?.userId !== userId);

  // Shuffle so every session deals a different hand, then deal 12.
  const deck = [...pool].sort(() => Math.random() - 0.5).slice(0, 12);
  const cards: RateCard[] = deck.map((s) => {
    const tax = pieceTaxonomy(s);
    const chips: string[] = [];
    if (tax.brand) chips.push(tax.brand);
    if (tax.silhouette && tax.silhouette !== tax.brand) chips.push(tax.silhouette);
    else if (!tax.silhouette && s.baseShoe) chips.push(s.baseShoe);
    if (tax.colorway) chips.push(`was “${tax.colorway}”`);
    if (s.category !== "sneakers") chips.push(categoryLabel(s.category));
    return {
      id: s.id,
      title: s.title,
      artistName: s.artist?.displayName ?? s.artistName,
      artistSlug: s.artist?.slug ?? null,
      images: [s.imageUrl, ...s.extraImages],
      chips,
    };
  });

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-12">
      <div className="mb-5 text-center">
        <h1 className="display text-3xl text-white">
          Rate The Heat
        </h1>
        <p className="mt-1 text-sm text-smoke">
          {ratedBefore > 0
            ? `${ratedBefore} rated so far — your taste profile is watching.`
            : "Score designs out of five flames. Your taste profile starts now."}
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
