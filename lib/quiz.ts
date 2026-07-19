import { prisma } from "./db";
import { iqFromCounts } from "./iq";

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
 * purchased credits. Returns which kind was spent so runs can track
 * paid-strike usage (paid runs are ineligible for giveaway entries),
 * or null when the user has neither.
 */
export async function consumeStrike(userId: string): Promise<"free" | "paid" | null> {
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
      return "free" as const;
    }
    if (user.credits > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { credits: { decrement: 1 } },
      });
      await tx.creditTransaction.create({
        data: { userId, delta: -1, reason: "strike" },
      });
      return "paid" as const;
    }
    return null;
  });
}

export type QuizBadge = { key: string; label: string; emoji: string; description: string };

export type LeaderboardEntry = {
  userId: string;
  name: string;
  iq: number; // Culture IQ — the ranking stat
  wins: number;
  answered: number;
  correct: number;
  accuracy: number; // 0-100
  badges: QuizBadge[];
};

export function computeBadges(stats: { wins: number; answered: number; correct: number }): QuizBadge[] {
  const badges: QuizBadge[] = [];
  const accuracy = stats.answered > 0 ? (stats.correct / stats.answered) * 100 : 0;
  if (stats.wins >= 1) badges.push({ key: "first", label: "Certified", emoji: "🏅", description: "Passed your first Heat Check" });
  if (stats.wins >= 5) badges.push({ key: "five", label: "Heat Scholar", emoji: "🎓", description: "5 Heat Checks passed" });
  if (stats.wins >= 10) badges.push({ key: "ten", label: "Encyclopedia", emoji: "📚", description: "10 Heat Checks passed" });
  if (stats.answered >= 100) badges.push({ key: "grinder", label: "Grinder", emoji: "⚙️", description: "100+ questions answered" });
  if (stats.answered >= 50 && accuracy >= 90) badges.push({ key: "sharp", label: "Sharpshooter", emoji: "🎯", description: "90%+ accuracy over 50+ answers" });
  return badges;
}

/**
 * The Culture IQ leaderboard: one score, every question on the site.
 * Feed quiz cards and Heat Check runs write into the same QuizAnswer
 * ledger, so the ranking stat is Culture IQ (100 + 2 per correct − 3
 * per uncleared miss). Checks passed and accuracy stay as the
 * tiebreakers and the flex line. Paid runs count here — this is for
 * bragging rights, not giveaway odds.
 */
export async function getQuizLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const [correctRows, missRows, runRows, wonRows] = await Promise.all([
    prisma.quizAnswer.groupBy({
      by: ["userId"],
      where: { correct: true },
      _count: { _all: true },
    }),
    prisma.quizAnswer.groupBy({
      by: ["userId"],
      where: { correct: false, cleared: false },
      _count: { _all: true },
    }),
    prisma.quizRun.groupBy({
      by: ["userId"],
      _sum: { correctCount: true, wrongCount: true },
    }),
    prisma.quizRun.groupBy({
      by: ["userId"],
      where: { status: "WON" },
      _count: { _all: true },
    }),
  ]);
  const correctByUser = new Map(correctRows.map((r) => [r.userId, r._count._all]));
  const missByUser = new Map(missRows.map((r) => [r.userId, r._count._all]));
  const winsByUser = new Map(wonRows.map((r) => [r.userId, r._count._all]));
  const runByUser = new Map(runRows.map((r) => [r.userId, r._sum]));

  const userIds = [
    ...new Set([...correctByUser.keys(), ...missByUser.keys(), ...runByUser.keys()]),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameByUser = new Map(users.map((u) => [u.id, u.name ?? "Sneakerhead"]));

  return userIds
    .map((userId) => {
      const ledgerCorrect = correctByUser.get(userId) ?? 0;
      const ledgerMisses = missByUser.get(userId) ?? 0;
      const runs = runByUser.get(userId);
      // Display stats blend both surfaces; answered prefers the ledger
      // (feed + game) and falls back to legacy run totals.
      const runAnswered = (runs?.correctCount ?? 0) + (runs?.wrongCount ?? 0);
      const answered = Math.max(ledgerCorrect + ledgerMisses, runAnswered);
      const correct = Math.max(ledgerCorrect, runs?.correctCount ?? 0);
      const wins = winsByUser.get(userId) ?? 0;
      const stats = { wins, answered, correct };
      return {
        userId,
        name: nameByUser.get(userId) ?? "Sneakerhead",
        iq: iqFromCounts(ledgerCorrect, ledgerMisses),
        wins,
        answered,
        correct,
        accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
        badges: computeBadges(stats),
      };
    })
    .filter((e) => e.answered > 0)
    .sort((a, b) => b.iq - a.iq || b.wins - a.wins || b.answered - a.answered)
    .slice(0, limit);
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
