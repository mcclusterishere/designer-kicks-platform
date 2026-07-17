import { prisma } from "./db";

// Game economy — tune these to taste.
export const FREE_STRIKES_PER_DAY = 3; // free wrong answers per day
export const HEAT_CHECK_TARGET = 12; // correct answers needed to win an entry
export const RUN_QUEUE_SIZE = 30; // questions queued per run (no repeats within a run)
export const PACK_SIZE = 4; // strikes per credit pack
export const PACK_PRICE_CENTS = 100; // $1

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export type StrikeState = { freeLeft: number; credits: number };

export async function getStrikeState(userId: string): Promise<StrikeState> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { credits: true, freeStrikesDate: true, freeStrikesUsed: true },
  });
  const usedToday = user.freeStrikesDate === todayStr() ? user.freeStrikesUsed : 0;
  return { freeLeft: Math.max(0, FREE_STRIKES_PER_DAY - usedToday), credits: user.credits };
}

/**
 * Spends one strike (a wrong answer): free daily strikes first, then
 * purchased credits. Returns false when the user has neither.
 */
export async function consumeStrike(userId: string): Promise<boolean> {
  const today = todayStr();
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { credits: true, freeStrikesDate: true, freeStrikesUsed: true },
    });
    const usedToday = user.freeStrikesDate === today ? user.freeStrikesUsed : 0;

    if (usedToday < FREE_STRIKES_PER_DAY) {
      await tx.user.update({
        where: { id: userId },
        data: { freeStrikesDate: today, freeStrikesUsed: usedToday + 1 },
      });
      return true;
    }
    if (user.credits > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { credits: { decrement: 1 } },
      });
      await tx.creditTransaction.create({
        data: { userId, delta: -1, reason: "strike" },
      });
      return true;
    }
    return false;
  });
}

export async function grantCredits(
  userId: string,
  amount: number,
  reason: string,
  stripeSessionId?: string
): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    }),
    prisma.creditTransaction.create({
      data: { userId, delta: amount, reason, stripeSessionId },
    }),
  ]);
}

export async function getActiveGiveaway() {
  return prisma.giveaway.findFirst({
    where: { status: "ACTIVE", endsAt: { gt: new Date() } },
    orderBy: { endsAt: "asc" },
    include: { _count: { select: { entries: true } } },
  });
}

/** The public shape of a question — never includes the answer. */
export type PublicQuestion = {
  id: string;
  question: string;
  options: string[];
  category: string;
  difficulty: number;
};

export function toPublicQuestion(q: {
  id: string;
  question: string;
  options: string;
  category: string;
  difficulty: number;
}): PublicQuestion {
  return {
    id: q.id,
    question: q.question,
    options: JSON.parse(q.options) as string[],
    category: q.category,
    difficulty: q.difficulty,
  };
}

export async function getActiveRun(userId: string) {
  return prisma.quizRun.findFirst({
    where: { userId, status: { in: ["ACTIVE", "NEEDS_CREDITS"] } },
    orderBy: { startedAt: "desc" },
  });
}

export async function getCurrentQuestion(run: {
  questionIds: string;
  currentIndex: number;
}): Promise<PublicQuestion | null> {
  const ids = JSON.parse(run.questionIds) as string[];
  const id = ids[run.currentIndex];
  if (!id) return null;
  const q = await prisma.quizQuestion.findUnique({ where: { id } });
  return q ? toPublicQuestion(q) : null;
}
