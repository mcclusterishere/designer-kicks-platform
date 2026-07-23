import { prisma } from "@/lib/db";
import { getTasteProfile } from "@/lib/taste";
import { pieceTaxonomy, retailKind } from "@/lib/taxonomy";
import { categoryLabel } from "@/lib/categories";
import type { RateCard } from "@/components/RateDeck";

/**
 * Deals a Rate-game hand. Extracted from the page so the deck can be
 * ENDLESS: the client asks for another hand whenever it runs low, and
 * because rated pieces are excluded at the query level, every re-deal
 * is fresh. `excludeIds` keeps passed-on cards out of the same
 * session's next hand.
 */
export async function buildRateDeck(
  userId: string,
  size = 12,
  excludeIds: string[] = []
): Promise<RateCard[]> {
  const exclude = excludeIds.slice(-300);

  const prefRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { shopFor: true, laneStrict: true },
  });
  const pref = prefRow?.shopFor;
  const lane = pref === "mens" || pref === "womens" || pref === "kids" ? pref : null;
  const strict = Boolean(prefRow?.laneStrict);

  const [rawPool, retailPool, taste] = await Promise.all([
    prisma.submission.findMany({
      where: {
        status: "APPROVED",
        ratings: { none: { userId } },
        ...(exclude.length ? { id: { notIn: exclude } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { artist: { select: { slug: true, displayName: true, userId: true } } },
    }),
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
        AND NOT (id = ANY(${exclude}))
        AND (${lane && strict ? lane : null}::text IS NULL OR gender = ${lane && strict ? lane : null}::text)
      ORDER BY random()
      LIMIT 150`,
    getTasteProfile(userId),
  ]);

  // No rating your own work or your own closet — filtered here because
  // SQL NOT on nullable columns silently drops the NULL rows.
  const pool = rawPool.filter((s) => s.ownerId !== userId && s.artist?.userId !== userId);

  const brandShare = new Map((taste?.brands ?? []).map((b) => [b.name, b.share]));
  const silShare = new Map((taste?.silhouettes ?? []).map((x) => [x.name, x.share]));
  const rankByTaste = (p: typeof retailPool) =>
    [...p]
      .map((r) => ({
        r,
        score:
          (r.brand ? brandShare.get(r.brand) ?? 0 : 0) +
          (r.silhouette ? silShare.get(r.silhouette) ?? 0 : 0) +
          Math.random() * 25,
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r);

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

  const retailShare = Math.max(1, Math.round(size / 3));
  const customShare = size - retailShare;
  const customsDeal = [...pool].sort(() => Math.random() - 0.5);
  const retailDeal = retailRanked.slice(0, retailShare + Math.max(0, customShare - customsDeal.length));
  const customsPick = customsDeal.slice(0, size - Math.min(retailShare, retailDeal.length));
  const mixed = [...customsPick.slice(1), ...retailDeal.map((r) => ({ __retail: r }))]
    .sort(() => Math.random() - 0.5);
  const deck = [...customsPick.slice(0, 1), ...mixed].slice(0, size);

  const retailCard = (r: (typeof retailPool)[number]): RateCard => {
    const chips: string[] = [];
    if (r.brand) chips.push(r.brand);
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

  return deck.map((entry) => {
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
}
