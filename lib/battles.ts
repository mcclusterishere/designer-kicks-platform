import { prisma } from "./db";
import { advanceTournaments } from "./tournaments";

/**
 * Completes any ACTIVE battle whose clock has run out, crowning the
 * submission with more votes. A tie leaves winnerId null (tournament
 * matches resolve ties in favor of the higher seed). Also advances any
 * tournaments whose rounds just completed. Called lazily from pages
 * that show battle state, plus the cron endpoint.
 */
export async function finalizeExpiredBattles() {
  const expired = await prisma.battle.findMany({
    where: { status: "ACTIVE", endsAt: { lt: new Date() } },
    select: { id: true, subAId: true, subBId: true },
  });

  for (const battle of expired) {
    const [aVotes, bVotes] = await Promise.all([
      prisma.vote.count({
        where: { battleId: battle.id, submissionId: battle.subAId },
      }),
      prisma.vote.count({
        where: { battleId: battle.id, submissionId: battle.subBId },
      }),
    ]);
    const winnerId =
      aVotes === bVotes ? null : aVotes > bVotes ? battle.subAId : battle.subBId;
    await prisma.battle.update({
      where: { id: battle.id },
      data: { status: "COMPLETED", winnerId },
    });
  }

  await advanceTournaments();
}

export type HeatEntry = {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string | null;
  socialHandle: string | null;
  baseShoe: string;
  imageUrl: string;
  wins: number;
  battles: number;
  totalVotes: number;
  heatScore: number;
};

/**
 * The Heat List: every approved submission ranked by battle wins first,
 * then total votes collected across all battles.
 */
export async function getHeatList(): Promise<HeatEntry[]> {
  const submissions = await prisma.submission.findMany({
    where: { status: "APPROVED" },
    include: {
      _count: { select: { votes: true, battlesWon: true } },
      battlesAsA: { select: { status: true } },
      battlesAsB: { select: { status: true } },
      artist: { select: { slug: true } },
    },
  });

  const entries: HeatEntry[] = submissions.map((s) => {
    const battles =
      s.battlesAsA.filter((b) => b.status === "COMPLETED").length +
      s.battlesAsB.filter((b) => b.status === "COMPLETED").length;
    const wins = s._count.battlesWon;
    const totalVotes = s._count.votes;
    return {
      id: s.id,
      title: s.title,
      artistName: s.artistName,
      artistSlug: s.artist?.slug ?? null,
      socialHandle: s.socialHandle,
      baseShoe: s.baseShoe,
      imageUrl: s.imageUrl,
      wins,
      battles,
      totalVotes,
      heatScore: wins * 1000 + totalVotes,
    };
  });

  return entries.sort((a, b) => b.heatScore - a.heatScore);
}

export async function getBattleWithVotes(battleId: string) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      subA: { include: { artist: { select: { slug: true } } } },
      subB: { include: { artist: { select: { slug: true } } } },
    },
  });
  if (!battle) return null;

  const [aVotes, bVotes] = await Promise.all([
    prisma.vote.count({
      where: { battleId: battle.id, submissionId: battle.subAId },
    }),
    prisma.vote.count({
      where: { battleId: battle.id, submissionId: battle.subBId },
    }),
  ]);
  return { battle, aVotes, bVotes };
}
