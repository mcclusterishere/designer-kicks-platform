import { prisma } from "./db";

/**
 * Culture IQ — the score that follows every fan around. Everyone
 * starts at 100 (a normal amount of culture). Every correct answer is
 * +2, every uncleared miss is −3. Clearing a miss costs 1 credit and
 * burns the question: the penalty goes away, the points can never be
 * earned, and the question never comes back.
 */
export function iqFromCounts(correct: number, wrongUncleared: number): number {
  return 100 + correct * 2 - wrongUncleared * 3;
}

export async function cultureIQ(
  userId: string
): Promise<{ iq: number; correct: number; misses: number; cleared: number }> {
  const [correct, misses, cleared] = await Promise.all([
    prisma.quizAnswer.count({ where: { userId, correct: true } }),
    prisma.quizAnswer.count({ where: { userId, correct: false, cleared: false } }),
    prisma.quizAnswer.count({ where: { userId, correct: false, cleared: true } }),
  ]);
  return { iq: iqFromCounts(correct, misses), correct, misses, cleared };
}

// The fashion-knowledge bar for the ambassador program: 120 IQ = at
// least ten questions answered right with no unpaid misses. High
// enough to prove they know fashion, low enough that a real one
// clears it in two quiz runs — and every applicant becomes a player.
export const AMBASSADOR_MIN_IQ = 120;
