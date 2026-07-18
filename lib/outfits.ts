import { prisma } from "./db";

export const OUTFIT_INCLUDE = {
  items: {
    include: {
      submission: {
        include: { artist: { select: { slug: true, displayName: true, status: true } } },
      },
    },
  },
  owner: { select: { name: true, collectorSlug: true } },
} as const;

/** Settle every expired fit battle — most votes wins, tie goes to A. */
export async function finalizeExpiredOutfitBattles() {
  const expired = await prisma.outfitBattle.findMany({
    where: { status: "ACTIVE", endsAt: { lte: new Date() } },
    include: { votes: { select: { outfitId: true } } },
  });
  for (const b of expired) {
    const aVotes = b.votes.filter((v) => v.outfitId === b.outfitAId).length;
    const bVotes = b.votes.filter((v) => v.outfitId === b.outfitBId).length;
    await prisma.outfitBattle.update({
      where: { id: b.id },
      data: { status: "COMPLETED", winnerId: bVotes > aVotes ? b.outfitBId : b.outfitAId },
    });
  }
}

export async function getOutfitBattles() {
  await finalizeExpiredOutfitBattles();
  return prisma.outfitBattle.findMany({
    orderBy: [{ status: "asc" }, { endsAt: "desc" }],
    include: {
      votes: { select: { outfitId: true } },
      outfitA: { include: OUTFIT_INCLUDE },
      outfitB: { include: OUTFIT_INCLUDE },
    },
  });
}
