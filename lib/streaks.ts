/**
 * Showing up, rewarded.
 *
 * The Facebook bot tells people, in its own words, that "logging in day
 * after day builds a streak that keeps you in the running". Until this
 * file existed that was simply untrue: nothing recorded a visit, no
 * streak existed, and the only way to earn a giveaway entry was to play
 * the quiz. Somebody could follow the bot's instructions exactly for a
 * month and hold zero entries. This is what makes the sentence true.
 *
 * Two rules, deliberately few enough to state in the official rules
 * without a footnote:
 *   1. Every day you show up, you get an entry.
 *   2. Reaching a streak milestone pays a bonus on top.
 *
 * Free by construction, which is what keeps it on the right side of the
 * sweepstakes wall this codebase already enforces elsewhere: purchased
 * strikes can never buy odds (quiz-actions.ts refuses a paid run), and
 * nothing here can be bought either.
 */
import { cache } from "react";
import { prisma } from "./db";
import { activeGiveawaySelector, todayStr } from "./quiz";

/** An entry for turning up at all. */
export const STREAK_ENTRIES_PER_DAY = 1;

/**
 * Bonus entries the day a streak reaches this length. Product numbers,
 * not law: change them here and the rules page reads the same constants,
 * so the published terms cannot drift from the behaviour.
 */
export const STREAK_MILESTONES: ReadonlyArray<{ days: number; bonus: number }> = [
  { days: 7, bonus: 3 },
  { days: 30, bonus: 10 },
];

export type StreakState = {
  current: number;
  longest: number;
  /** Entries minted on THIS visit. Zero on every render after the first. */
  entriesEarned: number;
  /** True when a milestone paid out on this visit, for the "nice" toast. */
  milestone: number | null;
};

/** Yesterday, in the same UTC day-key format the rest of the app uses. */
export function dayBefore(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** What a given streak length earns on the day it is reached. */
export function entriesForDay(streak: number): number {
  const bonus = STREAK_MILESTONES.find((m) => m.days === streak)?.bonus ?? 0;
  return STREAK_ENTRIES_PER_DAY + bonus;
}

/**
 * Count today, once.
 *
 * Called from the root layout, which runs on every page render, so the
 * shape that matters is the fast path: when the caller already knows
 * lastSeenDay is today it should not call this at all, and when it does
 * call, the unique constraint on LoginDay decides the race rather than
 * any locking of ours.
 *
 * Never throws. A member's visit must not 500 because the prize ledger
 * had a bad day.
 */
export async function touchStreak(userId: string): Promise<StreakState | null> {
  const today = todayStr();
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastSeenDay: true, currentStreak: true, longestStreak: true },
    });
    if (!user) return null;
    if (user.lastSeenDay === today) {
      return {
        current: user.currentStreak,
        longest: user.longestStreak,
        entriesEarned: 0,
        milestone: null,
      };
    }

    // Yesterday continues the run. Anything else, including a null from
    // an account that predates this feature, starts a fresh one at 1.
    const current = user.lastSeenDay === dayBefore(today) ? user.currentStreak + 1 : 1;
    const longest = Math.max(current, user.longestStreak);
    const milestone = STREAK_MILESTONES.find((m) => m.days === current) ?? null;
    const earned = entriesForDay(current);

    const minted = await prisma.$transaction(async (tx) => {
      // Whoever creates this row owns today. A second concurrent render
      // throws here, rolls back, and mints nothing.
      await tx.loginDay.create({ data: { userId, day: today, streak: current, entries: 0 } });

      // Entries only exist while a giveaway is actually running. The
      // streak still advances without one, so a gap between giveaways
      // does not punish somebody's twenty-day run.
      // The SAME selector the quiz and the league use. This picked the
      // most recently created giveaway once, which is a different one
      // the moment two are live at the same time: entries would land in
      // the new giveaway while /giveaway counted the old one, and the
      // member would see a number that did not match what they earned.
      const giveaway = await tx.giveaway.findFirst({
        ...activeGiveawaySelector(),
        select: { id: true },
      });
      let n = 0;
      if (giveaway) {
        n = earned;
        await tx.giveawayEntry.createMany({
          data: Array.from({ length: n }, () => ({
            giveawayId: giveaway.id,
            userId,
            source: "streak",
          })),
        });
      }
      await tx.loginDay.update({
        where: { userId_day: { userId, day: today } },
        data: { entries: n },
      });
      await tx.user.update({
        where: { id: userId },
        data: { lastSeenDay: today, currentStreak: current, longestStreak: longest },
      });
      return n;
    });

    return { current, longest, entriesEarned: minted, milestone: milestone?.days ?? null };
  } catch {
    // Either another render won today's race, or the database is having
    // a moment. Both mean the same thing to the caller: nothing to show.
    return null;
  }
}

/**
 * The streak as of THIS request, counted first.
 *
 * The layout and the page render CONCURRENTLY in the App Router, not one
 * after the other. So a page that read the streak with its own query
 * raced the layout's write and lost: on the first visit of every day a
 * member saw yesterday's streak, the day-two nudge never appeared on day
 * two, and the giveaway page said "You have 0 entries" in the same
 * moment their free daily entry was being created. On a sweepstakes page
 * that is not a cosmetic bug.
 *
 * React.cache dedupes by argument for the life of one request, so every
 * caller here shares ONE touch: whoever asks first starts it and
 * everybody else awaits the same promise. That makes the write happen
 * before any of them read, which is the whole point, and it costs one
 * touchStreak per request rather than one per caller.
 */
export const streakNow = cache(
  async (userId: string): Promise<{ current: number; longest: number; countedToday: boolean }> => {
    const touched = await touchStreak(userId);
    if (touched) {
      return { current: touched.current, longest: touched.longest, countedToday: true };
    }
    // touchStreak only returns null when it genuinely could not write.
    // Fall back to reading, so a database hiccup shows a stale streak
    // rather than no page.
    return streakFor(userId);
  }
);

/** Read-only. Prefer streakNow anywhere a render could race the touch. */
export async function streakFor(
  userId: string
): Promise<{ current: number; longest: number; countedToday: boolean }> {
  const user = await prisma.user
    .findUnique({
      where: { id: userId },
      select: { lastSeenDay: true, currentStreak: true, longestStreak: true },
    })
    .catch(() => null);
  if (!user) return { current: 0, longest: 0, countedToday: false };
  return {
    current: user.currentStreak,
    longest: user.longestStreak,
    countedToday: user.lastSeenDay === todayStr(),
  };
}

/**
 * The streak rules in one sentence each, so the giveaway page, the
 * official rules and the chat bot all read from the same source rather
 * than three people's memory of what was decided.
 */
export function streakRuleLines(): string[] {
  return [
    `Show up any day and you get ${STREAK_ENTRIES_PER_DAY} free entry for that day.`,
    ...STREAK_MILESTONES.map(
      (m) => `Reach a ${m.days}-day streak and you get ${m.bonus} bonus entries.`
    ),
    "Miss a day and the streak starts again at one. Entries you already earned are yours to keep.",
  ];
}
