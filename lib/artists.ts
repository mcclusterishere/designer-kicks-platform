import { prisma } from "./db";
import { slugify } from "./articles";

/**
 * Finds the user's artist profile, creating one on first submission.
 * Slugs come from the display name, suffixed on collision.
 */
export async function ensureArtistProfile(
  userId: string,
  displayName: string,
  instagram?: string | null
) {
  const existing = await prisma.artistProfile.findUnique({ where: { userId } });
  if (existing) return existing;

  const base = slugify(displayName) || "artist";
  let slug = base;
  for (let i = 2; ; i++) {
    const clash = await prisma.artistProfile.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `${base}-${i}`;
  }

  return prisma.artistProfile.create({
    data: { userId, slug, displayName, instagram: instagram || null },
  });
}

export type ArtistRanking = {
  id: string;
  slug: string;
  displayName: string;
  instagram: string | null;
  city: string | null;
  wins: number;
  losses: number;
  battles: number;
  totalVotes: number;
  followers: number;
  shoeCount: number;
  topImageUrl: string | null;
  heatScore: number;
};

/**
 * Artist league table: career wins first, then total votes across all
 * of an artist's shoes. Only artists with at least one approved shoe.
 */
export async function getArtistRankings(): Promise<ArtistRanking[]> {
  const artists = await prisma.artistProfile.findMany({
    include: {
      _count: { select: { followers: true } },
      submissions: {
        where: { status: "APPROVED" },
        include: {
          _count: { select: { votes: true, battlesWon: true } },
          battlesAsA: { select: { status: true } },
          battlesAsB: { select: { status: true } },
        },
      },
    },
  });

  return artists
    .filter((a) => a.submissions.length > 0)
    .map((a) => {
      let wins = 0;
      let battles = 0;
      let totalVotes = 0;
      let topImageUrl: string | null = null;
      let topShoeVotes = -1;

      for (const s of a.submissions) {
        wins += s._count.battlesWon;
        battles +=
          s.battlesAsA.filter((b) => b.status === "COMPLETED").length +
          s.battlesAsB.filter((b) => b.status === "COMPLETED").length;
        totalVotes += s._count.votes;
        if (s._count.votes > topShoeVotes) {
          topShoeVotes = s._count.votes;
          topImageUrl = s.imageUrl;
        }
      }

      return {
        id: a.id,
        slug: a.slug,
        displayName: a.displayName,
        instagram: a.instagram,
        city: a.city,
        wins,
        losses: battles - wins,
        battles,
        totalVotes,
        followers: a._count.followers,
        shoeCount: a.submissions.length,
        topImageUrl,
        heatScore: wins * 1000 + totalVotes,
      };
    })
    .sort((x, y) => y.heatScore - x.heatScore);
}

export async function getArtistBySlug(slug: string) {
  return prisma.artistProfile.findUnique({
    where: { slug },
    include: {
      _count: { select: { followers: true } },
      submissions: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { votes: true, battlesWon: true } },
          battlesAsA: { select: { status: true } },
          battlesAsB: { select: { status: true } },
        },
      },
    },
  });
}
