import { prisma } from "./db";
import { slugify } from "./articles";

export const TOURNAMENT_SIZES = [4, 8, 16] as const;

export function totalRounds(size: number): number {
  return Math.log2(size);
}

export function roundName(round: number, size: number): string {
  const remaining = totalRounds(size) - round;
  if (remaining === 0) return "Final";
  if (remaining === 1) return "Semifinals";
  if (remaining === 2) return "Quarterfinals";
  return `Round of ${size / Math.pow(2, round - 1)}`;
}

/**
 * Standard single-elimination seeding: top seeds can only meet in late
 * rounds (4 → 1v4, 2v3; 8 → 1v8, 4v5, 2v7, 3v6; …). Returns 1-indexed
 * seed pairs in bracket-position order.
 */
export function bracketSeedPairs(size: number): [number, number][] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    for (const s of order) next.push(s, n + 1 - s);
    order = next;
  }
  const pairs: [number, number][] = [];
  for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
  return pairs;
}

/**
 * Creates a tournament with round-1 battles live immediately.
 * `seededSubmissionIds` must be ordered best seed first; the higher
 * seed becomes side A of each battle (and advances on a tied vote).
 */
export async function createTournament(opts: {
  name: string;
  prize?: string | null;
  size: number;
  roundDays: number;
  seededSubmissionIds: string[];
}) {
  const { name, prize, size, roundDays, seededSubmissionIds } = opts;

  const base = slugify(name) || "tournament";
  let slug = base;
  for (let i = 2; ; i++) {
    const clash = await prisma.tournament.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `${base}-${i}`;
  }

  const tournament = await prisma.tournament.create({
    data: { name, slug, size, prize: prize || null, roundDays },
  });

  const rounds = totalRounds(size);
  const pairs = bracketSeedPairs(size);

  for (let pos = 0; pos < pairs.length; pos++) {
    const [seedA, seedB] = pairs[pos];
    const subAId = seededSubmissionIds[seedA - 1];
    const subBId = seededSubmissionIds[seedB - 1];
    const battle = await prisma.battle.create({
      data: {
        title: `${roundName(1, size)} — ${name}`,
        subAId,
        subBId,
        endsAt: new Date(Date.now() + roundDays * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.tournamentMatch.create({
      data: {
        tournamentId: tournament.id,
        round: 1,
        position: pos,
        battleId: battle.id,
        subAId,
        subBId,
      },
    });
  }

  // Later rounds start as empty slots and fill as winners advance.
  for (let r = 2; r <= rounds; r++) {
    const slots = size / Math.pow(2, r);
    for (let pos = 0; pos < slots; pos++) {
      await prisma.tournamentMatch.create({
        data: { tournamentId: tournament.id, round: r, position: pos },
      });
    }
  }

  return tournament;
}

/**
 * Moves winners forward: syncs match winners from completed battles,
 * spins up next-round battles once both feeders are decided, and crowns
 * the champion when the final completes. Ties advance side A (the
 * higher seed). Idempotent — safe from cron and page loads alike.
 */
export async function advanceTournaments() {
  const tournaments = await prisma.tournament.findMany({
    where: { status: "ACTIVE" },
    include: { matches: { include: { battle: true } } },
  });

  for (const t of tournaments) {
    const rounds = totalRounds(t.size);

    for (const m of t.matches) {
      if (!m.winnerId && m.battle?.status === "COMPLETED") {
        const winnerId = m.battle.winnerId ?? m.battle.subAId;
        await prisma.tournamentMatch.update({
          where: { id: m.id },
          data: { winnerId },
        });
        m.winnerId = winnerId;
      }
    }

    for (let r = 1; r < rounds; r++) {
      const roundMatches = t.matches.filter((m) => m.round === r);
      for (const nm of t.matches.filter((m) => m.round === r + 1)) {
        if (nm.battleId) continue;
        const f1 = roundMatches.find((m) => m.position === nm.position * 2);
        const f2 = roundMatches.find((m) => m.position === nm.position * 2 + 1);
        if (f1?.winnerId && f2?.winnerId) {
          const battle = await prisma.battle.create({
            data: {
              title: `${roundName(r + 1, t.size)} — ${t.name}`,
              subAId: f1.winnerId,
              subBId: f2.winnerId,
              endsAt: new Date(Date.now() + t.roundDays * 24 * 60 * 60 * 1000),
            },
          });
          await prisma.tournamentMatch.update({
            where: { id: nm.id },
            data: { battleId: battle.id, subAId: f1.winnerId, subBId: f2.winnerId },
          });
        }
      }
    }

    const final = t.matches.find((m) => m.round === rounds && m.position === 0);
    if (final?.winnerId) {
      await prisma.tournament.update({
        where: { id: t.id },
        data: { status: "COMPLETED", championId: final.winnerId },
      });
    }
  }
}

export async function getTournamentBySlug(slug: string) {
  return prisma.tournament.findUnique({
    where: { slug },
    include: {
      champion: { include: { artist: { select: { slug: true } } } },
      matches: {
        orderBy: [{ round: "asc" }, { position: "asc" }],
        include: {
          subA: { include: { artist: { select: { slug: true } } } },
          subB: { include: { artist: { select: { slug: true } } } },
          battle: { include: { votes: { select: { submissionId: true } } } },
        },
      },
    },
  });
}

export async function listTournaments() {
  return prisma.tournament.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { champion: true, _count: { select: { matches: true } } },
  });
}
