import { prisma } from "./db";
import { pieceTaxonomy } from "./taxonomy";

// The taste engine. Every signal a fan gives off — battle votes, fit
// votes, Rate-game scores, pieces they own, offers they've made,
// artists they follow, plus what they told us in their passport —
// rolls into one weighted profile: brands, silhouettes, categories,
// artists, colorways, and an archetype title to make it feel earned.

const WEIGHTS = {
  vote: 2, // picked it in a battle
  outfitItem: 1, // voted a fit containing it
  owned: 5, // put money (or a claim) on it
  offer: 3, // tried to put money on it
  follow: 3, // artist affinity only
  stated: 2, // passport favorites — what they SAY they like
} as const;

// Rate-game scores: love counts, hate doesn't accumulate taste.
function ratingWeight(stars: number) {
  return Math.max(0, stars - 2); // 5→3, 4→2, 3→1, 1–2→0
}

type Ranked = { name: string; weight: number; share: number };

export type TasteProfile = {
  signalCount: number;
  ratingsCount: number;
  brands: Ranked[];
  silhouettes: Ranked[];
  categories: Ranked[];
  artists: Ranked[];
  colorways: Ranked[];
  archetype: { emoji: string; title: string; blurb: string };
};

const PIECE_SELECT = {
  brand: true,
  silhouette: true,
  baseColorway: true,
  baseShoe: true,
  category: true,
  artistName: true,
  artist: { select: { displayName: true } },
} as const;

type PieceLite = {
  brand: string | null;
  silhouette: string | null;
  baseColorway: string | null;
  baseShoe: string | null;
  category: string | null;
  artistName: string;
  artist: { displayName: string } | null;
};

function bump(map: Map<string, number>, key: string | null | undefined, w: number) {
  if (!key || w <= 0) return;
  map.set(key, (map.get(key) ?? 0) + w);
}

function ranked(map: Map<string, number>, take: number): Ranked[] {
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([name, weight]) => ({ name, weight, share: Math.round((weight / total) * 100) }));
}

function archetypeFor(p: {
  brands: Ranked[];
  silhouettes: Ranked[];
  categories: Ranked[];
  ratingsCount: number;
}): TasteProfile["archetype"] {
  const topBrand = p.brands[0];
  const topCat = p.categories[0];
  const sil = (p.silhouettes[0]?.name ?? "").toLowerCase();

  if (topCat && topCat.name !== "sneakers" && topCat.share >= 40) {
    return topCat.name === "apparel"
      ? { emoji: "🧥", title: "Full-Fit Curator", blurb: "You vote head-to-toe. The shoes matter, but the whole silhouette decides it." }
      : { emoji: "🧢", title: "Details Head", blurb: "Hats, charms, hardware — you know the last 10% is where a look is won." };
  }
  if (topBrand?.name === "Jordan" && topBrand.share >= 40) {
    return { emoji: "🏀", title: "Jumpman Loyalist", blurb: "Retro Js are your love language. If it's not on a Jordan, it has to work twice as hard for your vote." };
  }
  if (topBrand?.name === "Nike" && (sil.includes("force") || sil.includes("dunk"))) {
    return { emoji: "⛹️", title: "Court Classicist", blurb: "Forces and Dunks — the canvases that built custom culture. You respect the fundamentals." };
  }
  if (topBrand?.name === "New Balance" || topBrand?.name === "Asics") {
    return { emoji: "🏃", title: "Runner Refined", blurb: "Grey-day energy. You back craft over hype — premium materials on running blocks." };
  }
  if (topBrand?.name === "adidas") {
    return { emoji: "🛸", title: "Three-Stripes Futurist", blurb: "Boost, foam, knit — you vote for shapes the rest of the room hasn't caught up to yet." };
  }
  if (p.ratingsCount >= 15 && topBrand && topBrand.share < 35) {
    return { emoji: "⚖️", title: "Equal-Opportunity Judge", blurb: "No brand bias, high volume — your ratings move the chart because they're earned pair by pair." };
  }
  return { emoji: "🔥", title: "Certified Tastemaker", blurb: "Your profile is still sharpening — every vote and rating teaches the chart what heat means to you." };
}

/** Build a fan's taste profile from everything they've touched. */
export async function getTasteProfile(userId: string): Promise<TasteProfile | null> {
  const [user, votes, outfitVotes, ratings, offers, follows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        favoriteBrands: true,
        favoriteSilhouette: true,
        ownedPieces: { where: { status: "APPROVED" }, select: PIECE_SELECT },
      },
    }),
    prisma.vote.findMany({
      where: { userId },
      select: { submission: { select: PIECE_SELECT } },
    }),
    prisma.outfitVote.findMany({
      where: { userId },
      select: {
        battle: {
          select: {
            outfitA: { select: { id: true, items: { select: { submission: { select: PIECE_SELECT } } } } },
            outfitB: { select: { id: true, items: { select: { submission: { select: PIECE_SELECT } } } } },
          },
        },
        outfitId: true,
      },
    }),
    prisma.designRating.findMany({
      where: { userId },
      select: { stars: true, submission: { select: PIECE_SELECT } },
    }),
    prisma.offer.findMany({
      where: { buyerId: userId },
      select: { submission: { select: PIECE_SELECT } },
    }),
    prisma.artistFollow.findMany({
      where: { userId },
      select: { artist: { select: { displayName: true } } },
    }),
  ]);
  if (!user) return null;

  const brands = new Map<string, number>();
  const silhouettes = new Map<string, number>();
  const categories = new Map<string, number>();
  const artists = new Map<string, number>();
  const colorways = new Map<string, number>();
  let signalCount = 0;

  const addPiece = (piece: PieceLite, w: number) => {
    if (w <= 0) return;
    signalCount++;
    const tax = pieceTaxonomy(piece);
    bump(brands, tax.brand, w);
    bump(silhouettes, tax.silhouette, w);
    bump(categories, piece.category ?? "sneakers", w);
    bump(artists, piece.artist?.displayName ?? piece.artistName, w);
    bump(colorways, tax.colorway, w);
  };

  for (const v of votes) addPiece(v.submission, WEIGHTS.vote);
  for (const r of ratings) addPiece(r.submission, ratingWeight(r.stars));
  for (const p of user.ownedPieces) addPiece(p, WEIGHTS.owned);
  for (const o of offers) addPiece(o.submission, WEIGHTS.offer);
  for (const ov of outfitVotes) {
    const side = ov.battle.outfitA.id === ov.outfitId ? ov.battle.outfitA : ov.battle.outfitB;
    for (const item of side.items) addPiece(item.submission, WEIGHTS.outfitItem);
  }
  for (const f of follows) {
    signalCount++;
    bump(artists, f.artist.displayName, WEIGHTS.follow);
  }
  // Stated taste from the passport — a light prior, not the verdict.
  for (const b of (user.favoriteBrands ?? "").split(",")) bump(brands, b.trim() || null, WEIGHTS.stated);
  if (user.favoriteSilhouette?.trim()) bump(silhouettes, user.favoriteSilhouette.trim(), WEIGHTS.stated);

  // Ratings count even when low-star (they're signals, not taste weight).
  signalCount += ratings.filter((r) => ratingWeight(r.stars) === 0).length;

  if (signalCount === 0) return null;

  const profile = {
    brands: ranked(brands, 5),
    silhouettes: ranked(silhouettes, 5),
    categories: ranked(categories, 3),
    artists: ranked(artists, 4),
    colorways: ranked(colorways, 4),
    ratingsCount: ratings.length,
  };
  return {
    signalCount,
    ...profile,
    archetype: archetypeFor(profile),
  };
}
