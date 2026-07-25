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

export type IQBreakdown = { iq: number; correct: number; misses: number; cleared: number };

/**
 * The same scoring over one track.
 *
 * QuizAnswer doesn't carry the track — it doesn't need to, because it joins
 * to the question that does. Filtering through the relation keeps one source
 * of truth: re-tracking a question moves its answers with it instead of
 * leaving a denormalised copy behind to rot.
 */
async function iqForTrack(userId: string, track?: string): Promise<IQBreakdown> {
  const where = track ? { question: { track } } : {};
  const [correct, misses, cleared] = await Promise.all([
    prisma.quizAnswer.count({ where: { userId, correct: true, ...where } }),
    prisma.quizAnswer.count({ where: { userId, correct: false, cleared: false, ...where } }),
    prisma.quizAnswer.count({ where: { userId, correct: false, cleared: true, ...where } }),
  ]);
  return { iq: iqFromCounts(correct, misses), correct, misses, cleared };
}

/**
 * Culture IQ counts every track.
 *
 * Left deliberately unfiltered. It is the score that has followed players
 * around since the beginning, it is on leaderboards and the ambassador gate,
 * and quietly redefining it to exclude markets answers would silently drop
 * points people already earned. Market IQ is additive — a second reading of
 * the same ledger, not a reallocation of it.
 */
export async function cultureIQ(userId: string): Promise<IQBreakdown> {
  return iqForTrack(userId);
}

/** The markets-only score. Same formula, so the two are comparable. */
export async function marketIQ(userId: string): Promise<IQBreakdown> {
  return iqForTrack(userId, "markets");
}

/**
 * The desk ladder.
 *
 * Ranks are real roles that exist on a trading floor, ordered by how much
 * they have to understand — and each one has a plain sneaker equivalent, so
 * the title means something before you know what it means. Levels gate which
 * questions you're served: you don't get asked about margin calls before
 * you've been asked what a bid is.
 */
export const DESK_RANKS: { level: number; title: string; blurb: string; from: number }[] = [
  { level: 1, title: "Retail Buyer", blurb: "You pay the ask and take the price you're given.", from: 0 },
  { level: 2, title: "Resale Trader", blurb: "You know what the spread costs you.", from: 8 },
  { level: 3, title: "Market Maker", blurb: "You quote both sides and carry the inventory.", from: 16 },
  { level: 4, title: "Position Trader", blurb: "You hold risk over time, and you hedge it.", from: 24 },
  { level: 5, title: "Desk Head", blurb: "You read the whole book, not just your own position.", from: 32 },
  // Rungs 6-8 change subject. One to five teach how a market works; these
  // teach what actually trades on one — the instruments themselves, from
  // the Street Credit Bureau taxonomy. Mechanics first, then the zoo,
  // because knowing what a warrant is means nothing until you know what a
  // strike and an expiry are.
  { level: 6, title: "Product Specialist", blurb: "You know what each instrument is, not just what it's called.", from: 40 },
  { level: 7, title: "Structurer", blurb: "You can see what an instrument is built out of.", from: 48 },
  { level: 8, title: "Partner", blurb: "You've seen the whole zoo. Everything after this is depth.", from: 56 },
];

/** How many correct markets answers it takes to unlock the next rung. */
export const RANK_STEP = 8;

export function rankFor(correctMarketsAnswers: number) {
  let current = DESK_RANKS[0];
  for (const r of DESK_RANKS) if (correctMarketsAnswers >= r.from) current = r;
  const next = DESK_RANKS.find((r) => r.from > correctMarketsAnswers) ?? null;
  return {
    ...current,
    next,
    toNext: next ? next.from - correctMarketsAnswers : 0,
  };
}

// The fashion-knowledge bar for the ambassador program: 120 IQ = at
// least ten questions answered right with no unpaid misses. High
// enough to prove they know fashion, low enough that a real one
// clears it in two quiz runs — and every applicant becomes a player.
export const AMBASSADOR_MIN_IQ = 120;
