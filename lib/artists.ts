import { prisma } from "./db";
import { slugify } from "./articles";

export async function uniqueArtistSlug(displayName: string): Promise<string> {
  const base = slugify(displayName) || "artist";
  let slug = base;
  for (let i = 2; ; i++) {
    const clash = await prisma.artistProfile.findUnique({ where: { slug } });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
}

/**
 * Fans get a public collector URL the first time they take ownership of
 * a piece. Slug is minted once and kept forever.
 */
export async function ensureCollectorSlug(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.collectorSlug) return user.collectorSlug;

  const base = slugify(user.name ?? "collector") || "collector";
  let slug = base;
  for (let i = 2; ; i++) {
    const clash = await prisma.user.findUnique({ where: { collectorSlug: slug } });
    if (!clash) break;
    slug = `${base}-${i}`;
  }
  await prisma.user.update({ where: { id: userId }, data: { collectorSlug: slug } });
  return slug;
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
    where: { status: "APPROVED" },
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
  const artist = await prisma.artistProfile.findUnique({
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
          tournamentsWon: { select: { id: true, name: true } },
          owner: { select: { name: true, collectorSlug: true } },
          sales: { orderBy: { soldAt: "desc" } },
        },
      },
    },
  });
  // Pending/rejected artist accounts aren't public.
  return artist?.status === "APPROVED" ? artist : null;
}

/** Championship titles won by any of the artist's shoes. */
export async function getArtistTrophies(artistId: string) {
  return prisma.tournament.findMany({
    where: { status: "COMPLETED", champion: { artistId } },
    orderBy: { createdAt: "desc" },
    include: { champion: { select: { title: true, imageUrl: true } } },
  });
}
