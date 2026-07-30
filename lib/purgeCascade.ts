import { prisma } from "./db";

/**
 * Take a set of pieces out of the database completely.
 *
 * Split into its own module because the order matters and the reason for
 * the order isn't obvious from any single line of it.
 *
 * Most things pointing at a Submission cascade on delete and would clean
 * themselves up. Two do not:
 *
 *   - Battle.subA / Battle.subB have no onDelete rule at all, so deleting
 *     a piece that has ever been in a battle raises a foreign-key error
 *     and takes the whole transaction down with it. The battles have to
 *     go first.
 *   - TournamentMatch.subA / subB are nullable with no rule, so they get
 *     detached rather than deleted — a bracket that already happened is
 *     history, and history shouldn't vanish because a fixture account was
 *     tidied up.
 *
 * Everything here is deliberately not clever. A purge that half-succeeds
 * is worse than one that refuses, so it runs in dependency order and lets
 * an error surface rather than swallowing it.
 */
export async function deleteSubmissionsCascade(pieceIds: string[]): Promise<void> {
  if (pieceIds.length === 0) return;

  // Battles reference pieces with no delete rule — they block the delete.
  const battles = await prisma.battle.findMany({
    where: { OR: [{ subAId: { in: pieceIds } }, { subBId: { in: pieceIds } }] },
    select: { id: true },
  });
  const battleIds = battles.map((b) => b.id);

  // Bracket slots are nullable: detach, don't destroy the tournament.
  await prisma.tournamentMatch.updateMany({
    where: { subAId: { in: pieceIds } },
    data: { subAId: null },
  });
  await prisma.tournamentMatch.updateMany({
    where: { subBId: { in: pieceIds } },
    data: { subBId: null },
  });

  if (battleIds.length > 0) {
    await prisma.vote.deleteMany({ where: { battleId: { in: battleIds } } });
    await prisma.battle.deleteMany({ where: { id: { in: battleIds } } });
  }

  // A tournament whose champion is being removed shouldn't hold a dangling
  // pointer to it.
  await prisma.tournament.updateMany({
    where: { championId: { in: pieceIds } },
    data: { championId: null },
  });

  // An artist page featuring one of these on its wall.
  await prisma.artistProfile.updateMany({
    where: { featuredSubmissionId: { in: pieceIds } },
    data: { featuredSubmissionId: null },
  });

  // Sales carry money history and a buyer's email, so they go explicitly
  // rather than riding a cascade nobody reviewed.
  await prisma.sale.deleteMany({ where: { submissionId: { in: pieceIds } } });

  // The rest (offers, ratings, consignment, predictions, outfit slots,
  // closet entries) cascade correctly from the submission itself.
  await prisma.submission.deleteMany({ where: { id: { in: pieceIds } } });
}
