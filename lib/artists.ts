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
          // Account votes only: this total is the artist's public record.
          _count: { select: { votes: { where: { guest: false } }, battlesWon: true } },
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
      // NEVER select passwordHash here.
      //
      // This used to fetch the hash so the page could derive "is this
      // profile still unclaimed", with a comment saying the hash itself
      // must not leak. It leaked anyway, and the reason is worth
      // remembering: the page passed this whole artist object into a
      // client component. TypeScript accepted it because the component's
      // prop type is narrower and structural typing allows a wider object
      // — but types are erased at runtime, so React serialised the actual
      // object into the payload. Every public artist page was shipping the
      // artist's bcrypt hash in its HTML, harvestable by anyone with curl
      // and crackable offline at leisure.
      //
      // The lesson is that a comment cannot enforce this. So the hash is
      // no longer fetched at all: `accounts` covers OAuth sign-ups, and
      // the password case is answered by a separate count below that
      // returns a number, never the secret.
      user: { select: { _count: { select: { accounts: true } } } },
      submissions: {
        // Hidden pieces keep their votes, battles and league standing —
        // they just don't hang in the maker's own room. The order is the
        // maker's if they've arranged one, newest-first if they haven't.
        where: { status: "APPROVED", closetHidden: false },
        orderBy: [{ closetOrder: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        include: {
          _count: { select: { votes: { where: { guest: false } }, battlesWon: true } },
          battlesAsA: { select: { status: true } },
          battlesAsB: { select: { status: true } },
          tournamentsWon: { select: { id: true, name: true } },
          owner: { select: { name: true, collectorSlug: true } },
          // Explicit select: an unselected include returns every scalar,
          // and Sale carries buyerEmail. A public page must never carry a
          // buyer's address into the payload.
          sales: {
            orderBy: { soldAt: "desc" },
            select: { id: true, priceCents: true, soldAt: true, status: true, verified: true },
          },
          ratings: { select: { stars: true } },
          collaborators: { where: { status: "APPROVED" }, select: { slug: true, displayName: true } },
          // The open bid book, high bid first — powers Sell Now.
          offers: { where: { status: "OPEN" }, orderBy: { amountCents: "desc" } },
          consignment: true,
        },
      },
      // Pieces this artist co-built on someone else's page — the
      // Collabs shelf. Primary credit stays with the submitting artist.
      collabs: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        include: { artist: { select: { slug: true, displayName: true, status: true } } },
      },
    },
  });
  if (artist?.status !== "APPROVED") return null; // pending/rejected aren't public

  // Whether a password exists, as a boolean, computed without ever pulling
  // the hash into a value that could be handed to a component.
  const withPassword = await prisma.user.count({
    where: { id: artist.userId, passwordHash: { not: null } },
  });

  return { ...artist, hasPassword: withPassword > 0 };
}

/** Championship titles won by any of the artist's shoes. */
export async function getArtistTrophies(artistId: string) {
  return prisma.tournament.findMany({
    where: { status: "COMPLETED", champion: { artistId } },
    orderBy: { createdAt: "desc" },
    include: { champion: { select: { title: true, imageUrl: true } } },
  });
}
