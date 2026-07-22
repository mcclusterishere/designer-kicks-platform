import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { pieceTaxonomy, retailKind } from "@/lib/taxonomy";
import { categoryLabel } from "@/lib/categories";
import RateDeck, { type RateCard } from "@/components/RateDeck";
import { getTasteProfile } from "@/lib/taste";

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
  // Their shopping lane (profile → "Who do you shop for?"). Customs are
  // art and stay unfiltered; the retail side deals ~2/3 from their lane
  // with ~1/3 wild cards — unless they flipped on "only my lane".
  const prefRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { shopFor: true, laneStrict: true },
  });
  const pref = prefRow?.shopFor;
  const lane = pref === "mens" || pref === "womens" || pref === "kids" ? pref : null;
  const strict = Boolean(prefRow?.laneStrict);
  const [rawPool, retailPool, ratedBefore, ratedRetail, taste] = await Promise.all([
    prisma.submission.findMany({
      where: {
        status: "APPROVED",
        ratings: { none: { userId } },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { artist: { select: { slug: true, displayName: true, userId: true } } },
    }),
    // Real retail shoes from the catalog — the culture fans' lane. Only
    // shoes with photos make the deck; battles stay customs-only. Pulled
    // unfiltered, then weighted by lane below. Sampled ORDER BY random()
    // — recency ordering dealt a wall of whatever brand imported last.
    prisma.$queryRaw<
      {
        id: string; name: string; brand: string | null; silhouette: string | null;
        colorway: string | null; imageUrl: string | null; retailPriceCents: number | null;
        marketPriceCents: number | null; releaseDate: Date | null; gender: string | null;
      }[]
    >`
      SELECT id, name, brand, silhouette, colorway, "imageUrl",
             "retailPriceCents", "marketPriceCents", "releaseDate", gender
      FROM "CatalogShoe"
      WHERE "imageUrl" IS NOT NULL
        AND id NOT IN (SELECT "shoeId" FROM "CatalogRating" WHERE "userId" = ${userId})
        AND (${lane && strict ? lane : null}::text IS NULL OR gender = ${lane && strict ? lane : null}::text)
      ORDER BY random()
      LIMIT 150`,
    prisma.designRating.count({ where: { userId } }),
    prisma.catalogRating.count({ where: { userId } }),
    getTasteProfile(session.user.id),
  ]);
  // No rating your own work or your own closet — filtered here because
  // SQL NOT on nullable columns silently drops the NULL rows.
  const pool = rawPool.filter((s) => s.ownerId !== userId && s.artist?.userId !== userId);

  // Taste-weighted retail picks: shoes matching the fan's top brands /
  // silhouettes surface first, with a shuffle so it never feels canned.
  const brandShare = new Map((taste?.brands ?? []).map((b) => [b.name, b.share]));
  const silShare = new Map((taste?.silhouettes ?? []).map((x) => [x.name, x.share]));
  const rankByTaste = (pool: typeof retailPool) =>
    [...pool]
      .map((r) => ({
        r,
        score:
          (r.brand ? brandShare.get(r.brand) ?? 0 : 0) +
          (r.silhouette ? silShare.get(r.silhouette) ?? 0 : 0) +
          Math.random() * 25, // exploration keeps the deck surprising
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r);

  // The 66/33 deal: two lane picks, then a wild card, repeating. Strict
  // mode (or no preference) collapses to a single ranked stream.
  let retailRanked: typeof retailPool;
  if (lane && !strict) {
    const laneRanked = rankByTaste(retailPool.filter((r) => r.gender === lane));
    const wildRanked = rankByTaste(retailPool.filter((r) => r.gender !== lane));
    retailRanked = [];
    let li = 0, wi = 0;
    while (li < laneRanked.length || wi < wildRanked.length) {
      for (let k = 0; k < 2 && li < laneRanked.length; k++) retailRanked.push(laneRanked[li++]);
      if (wi < wildRanked.length) retailRanked.push(wildRanked[wi++]);
    }
  } else {
    retailRanked = rankByTaste(retailPool);
  }

  // Deal 12: customs stay the heart (8), real heat rides along (4).
  // Short pools backfill from the other side; a custom leads the deck.
  const customsDeal = [...pool].sort(() => Math.random() - 0.5);
  const retailDeal = retailRanked.slice(0, 4 + Math.max(0, 8 - customsDeal.length));
  const customsPick = customsDeal.slice(0, 12 - Math.min(4, retailDeal.length));
  const mixed = [...customsPick.slice(1), ...retailDeal.map((r) => ({ __retail: r }))]
    .sort(() => Math.random() - 0.5);
  const deck = [...customsPick.slice(0, 1), ...mixed].slice(0, 12);

  const retailCard = (r: (typeof retailPool)[number]): RateCard => {
    const chips: string[] = [];
    if (r.brand) chips.push(r.brand);
    // Non-footwear catalog items carry junk silhouettes ("Set",
    // "Hoodie") — show the real category instead.
    const kind = retailKind(r.name, r.silhouette);
    if (kind) chips.push(kind);
    else if (r.silhouette && r.silhouette !== r.brand) chips.push(r.silhouette);
    if (r.colorway) chips.push(`“${r.colorway}”`);
    const bits: string[] = [];
    if (r.marketPriceCents) bits.push(`Market ≈$${Math.round(r.marketPriceCents / 100)}`);
    if (r.retailPriceCents) bits.push(`Retail $${Math.round(r.retailPriceCents / 100)}`);
    if (r.releaseDate)
      bits.push(r.releaseDate.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }));
    return {
      id: r.id,
      title: r.name,
      artistName: r.brand ?? "Retail",
      artistSlug: null,
      images: [r.imageUrl!],
      chips,
      kind: "retail",
      value: bits.join(" · ") || null,
    };
  };

  const cards: RateCard[] = deck.map((entry) => {
    if ("__retail" in entry) return retailCard(entry.__retail);
    const s = entry;
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
      kind: "custom" as const,
    };
  });

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
