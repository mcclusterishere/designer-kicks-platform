import { prisma } from "./db";
import { pieceTaxonomy } from "./taxonomy";

const DAY = 24 * 60 * 60 * 1000;

/** Bucket timestamps into the last `days` calendar days (UTC), oldest first. */
export function dailySeries(dates: Date[], days: number): { day: string; count: number }[] {
  const out: { day: string; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY);
    out.push({ day: d.toISOString().slice(0, 10), count: 0 });
  }
  const index = new Map(out.map((r, i) => [r.day, i]));
  for (const date of dates) {
    const key = date.toISOString().slice(0, 10);
    const i = index.get(key);
    if (i !== undefined) out[i].count++;
  }
  return out;
}

/** Everything the artist's Studio dashboard needs, in one trip. */
export async function getStudioData(artistId: string) {
  const artist = await prisma.artistProfile.findUnique({
    where: { id: artistId },
    include: {
      user: { select: { id: true } },
      _count: { select: { followers: true } },
      submissions: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { votes: true, battlesWon: true } },
          battlesAsA: { select: { status: true } },
          battlesAsB: { select: { status: true } },
          offers: { where: { status: "OPEN" }, orderBy: { amountCents: "desc" } },
          sales: { orderBy: { soldAt: "desc" } },
          ratings: { select: { stars: true } },
        },
      },
    },
  });
  if (!artist) return null;

  const submissionIds = artist.submissions.map((s) => s.id);
  const [recentVotes, recentFollows, soldSales] = await Promise.all([
    prisma.vote.findMany({
      where: {
        submissionId: { in: submissionIds },
        createdAt: { gte: new Date(Date.now() - 14 * DAY) },
      },
      select: { createdAt: true },
    }),
    prisma.artistFollow.findMany({
      where: { artistId, createdAt: { gte: new Date(Date.now() - 14 * DAY) } },
      select: { createdAt: true },
    }),
    prisma.sale.findMany({
      where: { sellerId: artist.userId, status: "CONFIRMED" },
      orderBy: { soldAt: "desc" },
    }),
  ]);

  let wins = 0;
  let battles = 0;
  let totalVotes = 0;
  let openOffers = 0;
  let topOfferCents = 0;
  let starSum = 0;
  let starCount = 0;
  for (const s of artist.submissions) {
    starSum += s.ratings.reduce((sum, r) => sum + r.stars, 0);
    starCount += s.ratings.length;
    wins += s._count.battlesWon;
    battles +=
      s.battlesAsA.filter((b) => b.status === "COMPLETED").length +
      s.battlesAsB.filter((b) => b.status === "COMPLETED").length;
    totalVotes += s._count.votes;
    openOffers += s.offers.length;
    if (s.offers[0]) topOfferCents = Math.max(topOfferCents, s.offers[0].amountCents);
  }
  const revenueCents = soldSales.reduce((sum, s) => sum + s.priceCents, 0);

  return {
    artist,
    stats: {
      totalVotes,
      wins,
      losses: battles - wins,
      winRate: battles > 0 ? Math.round((wins / battles) * 100) : null,
      followers: artist._count.followers,
      views: artist.viewCount,
      revenueCents,
      salesCount: soldSales.length,
      openOffers,
      topOfferCents,
      ratingsCount: starCount,
      avgRating: starCount > 0 ? Math.round((starSum / starCount) * 10) / 10 : null,
    },
    votesSeries: dailySeries(recentVotes.map((v) => v.createdAt), 14),
    followsLast14: recentFollows.length,
    soldSales,
  };
}

/** The admin Site Pulse: headline totals, momentum, and leaders. */
export async function getSiteAnalytics() {
  const since7 = new Date(Date.now() - 7 * DAY);
  const since14 = new Date(Date.now() - 14 * DAY);

  const [
    members,
    members7,
    votes,
    votes7,
    quizRuns7,
    entries,
    confirmedSales,
    openOffers,
    activeBattles,
    publishedArticles,
    approvedArtists,
    recentVotes,
    recentSignups,
    topPieces,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7 } } }),
    prisma.vote.count(),
    prisma.vote.count({ where: { createdAt: { gte: since7 } } }),
    prisma.quizRun.count({ where: { startedAt: { gte: since7 } } }),
    prisma.giveawayEntry.count(),
    prisma.sale.findMany({ where: { status: "CONFIRMED" }, select: { priceCents: true } }),
    prisma.offer.count({ where: { status: "OPEN" } }),
    prisma.battle.count({ where: { status: "ACTIVE" } }),
    prisma.article.count({ where: { status: "PUBLISHED" } }),
    prisma.artistProfile.count({ where: { status: "APPROVED" } }),
    prisma.vote.findMany({
      where: { createdAt: { gte: since14 } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: since14 } },
      select: { createdAt: true },
    }),
    prisma.submission.findMany({
      where: { status: "APPROVED" },
      orderBy: { votes: { _count: "desc" } },
      take: 5,
      include: { _count: { select: { votes: true } } },
    }),
  ]);

  // Taste pulse: what the whole room is voting for, sliced by the
  // taxonomy under every custom — brand, silhouette, and star scores.
  const [taxPieces, ratingAggs, ratings7, ratingsAll] = await Promise.all([
    prisma.submission.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        title: true,
        artistName: true,
        brand: true,
        silhouette: true,
        baseColorway: true,
        baseShoe: true,
        category: true,
        _count: { select: { votes: true, ratings: true } },
      },
    }),
    prisma.designRating.groupBy({
      by: ["submissionId"],
      _avg: { stars: true },
      _count: true,
    }),
    prisma.designRating.count({ where: { createdAt: { gte: since7 } } }),
    prisma.designRating.aggregate({ _avg: { stars: true }, _count: true }),
  ]);

  const brandHeat = new Map<string, { votes: number; ratings: number }>();
  const silhouetteHeat = new Map<string, { votes: number; ratings: number }>();
  for (const p of taxPieces) {
    const tax = pieceTaxonomy(p);
    const engagement = { votes: p._count.votes, ratings: p._count.ratings };
    if (tax.brand) {
      const row = brandHeat.get(tax.brand) ?? { votes: 0, ratings: 0 };
      row.votes += engagement.votes;
      row.ratings += engagement.ratings;
      brandHeat.set(tax.brand, row);
    }
    if (tax.silhouette) {
      const row = silhouetteHeat.get(tax.silhouette) ?? { votes: 0, ratings: 0 };
      row.votes += engagement.votes;
      row.ratings += engagement.ratings;
      silhouetteHeat.set(tax.silhouette, row);
    }
  }
  const rankHeat = (map: Map<string, { votes: number; ratings: number }>) =>
    [...map.entries()]
      .map(([name, v]) => ({ name, ...v, total: v.votes + v.ratings }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

  const titleById = new Map(taxPieces.map((p) => [p.id, p]));
  // Bayesian-ish score: a lone 5.0 shouldn't outrank a 4.6 with volume.
  const topRated = ratingAggs
    .map((r) => {
      const piece = titleById.get(r.submissionId);
      const avg = r._avg.stars ?? 0;
      return piece
        ? {
            id: r.submissionId,
            title: piece.title,
            artistName: piece.artistName,
            avg: Math.round(avg * 10) / 10,
            count: r._count,
            score: (avg * r._count + 3.5 * 3) / (r._count + 3),
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    brandHeat: rankHeat(brandHeat),
    silhouetteHeat: rankHeat(silhouetteHeat),
    topRated,
    ratingsPulse: {
      ratings7,
      ratingsTotal: ratingsAll._count,
      avgStars: ratingsAll._count > 0 ? Math.round((ratingsAll._avg.stars ?? 0) * 10) / 10 : null,
    },
    tiles: {
      members,
      members7,
      votes,
      votes7,
      quizRuns7,
      entries,
      salesVolumeCents: confirmedSales.reduce((s, x) => s + x.priceCents, 0),
      salesCount: confirmedSales.length,
      openOffers,
      activeBattles,
      publishedArticles,
      approvedArtists,
    },
    votesSeries: dailySeries(recentVotes.map((v) => v.createdAt), 14),
    signupsSeries: dailySeries(recentSignups.map((u) => u.createdAt), 14),
    topPieces: topPieces.map((p) => ({
      id: p.id,
      title: p.title,
      artistName: p.artistName,
      votes: p._count.votes,
    })),
  };
}
