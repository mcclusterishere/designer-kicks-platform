/**
 * The streak system, tested where it can cost real money or real trust.
 *
 * This one is not like the other suites. A giveaway is a sweepstakes,
 * and the two things that matter legally are that the published rules
 * describe what the code actually does, and that nothing purchasable
 * can change somebody's odds. Both are asserted here, against the real
 * rules page, so a future edit to either side breaks the build rather
 * than the promise.
 *
 * The rest is idempotency: the touch runs on EVERY page render, so a
 * bug that mints twice mints thousands.
 *
 * Run: npm run verify:streaks   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import {
  STREAK_ENTRIES_PER_DAY,
  STREAK_MILESTONES,
  dayBefore,
  entriesForDay,
  streakRuleLines,
  touchStreak,
} from "../lib/streaks";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  // ---- Pure day maths ----------------------------------------------------
  check("yesterday of a normal day", dayBefore("2026-07-31") === "2026-07-30");
  check("yesterday across a month boundary", dayBefore("2026-08-01") === "2026-07-31");
  check("yesterday across a year boundary", dayBefore("2026-01-01") === "2025-12-31");
  check(
    "yesterday across a leap day",
    dayBefore("2028-03-01") === "2028-02-29",
    "2028 is a leap year; an off-by-one here silently breaks every streak that spans it"
  );

  // ---- The award table ---------------------------------------------------
  check("an ordinary day pays the daily entry", entriesForDay(1) === STREAK_ENTRIES_PER_DAY);
  check("a day just short of a milestone pays no bonus", entriesForDay(6) === STREAK_ENTRIES_PER_DAY);
  for (const m of STREAK_MILESTONES) {
    check(
      `day ${m.days} pays its ${m.bonus} bonus on top of the daily entry`,
      entriesForDay(m.days) === STREAK_ENTRIES_PER_DAY + m.bonus
    );
    check(
      `the day after the ${m.days}-day milestone goes back to normal`,
      entriesForDay(m.days + 1) === STREAK_ENTRIES_PER_DAY,
      "a milestone is a one-off, not a new permanent rate"
    );
  }

  // ---- The sweepstakes wall ----------------------------------------------
  // Nothing here may be purchasable. If a future edit lets credits or a
  // strike pack touch a streak, this is the tripwire.
  const src = readFileSync(join(process.cwd(), "lib", "streaks.ts"), "utf8");
  check(
    "nothing in the streak path reads credits or a paid strike",
    !/credits|usedPaidStrikes|stripe|purchase/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "")),
    "entries that money can influence would break the no-purchase-necessary promise"
  );
  check(
    "streak entries are labelled as their own source",
    /source: "streak"/.test(src),
    "the draw has to be auditable by where each entry came from"
  );

  // ---- The published rules must match the code ---------------------------
  const rules = readFileSync(join(process.cwd(), "app", "rules", "page.tsx"), "utf8");
  check(
    "the rules no longer claim entries come ONLY from the quiz",
    !/earned exclusively\s*\n?\s*by passing the Heat Check/.test(rules) &&
      !/exclusively by passing/.test(rules),
    "the bot promises a streak path, so 'exclusively the quiz' was a false published term"
  );
  check(
    "the rules still lead with no purchase necessary",
    /NO PURCHASE NECESSARY/.test(rules) &&
      /does not improve your\s*\n?\s*chances of winning/.test(rules)
  );
  check(
    "the rules describe the show-up method",
    /Show up/.test(rules) && /once per\s*\n?\s*calendar day/.test(rules)
  );
  check(
    "the rules read the award numbers from the code, not from memory",
    /STREAK_ENTRIES_PER_DAY/.test(rules) && /STREAK_MILESTONES/.test(rules),
    "hardcoded numbers in published terms drift the moment somebody tunes the game"
  );

  const giveaway = readFileSync(join(process.cwd(), "app", "giveaway", "page.tsx"), "utf8");
  check(
    "the giveaway page summary also dropped the exclusivity claim",
    !/exclusively by playing/.test(giveaway)
  );
  check(
    "the giveaway page lists the streak rules from the same source",
    /streakRuleLines\(\)/.test(giveaway)
  );
  check(
    "the rule lines say what happens when you miss a day",
    streakRuleLines().some((l) => /starts again at one/i.test(l)),
    "a streak system that doesn't say how it breaks is a complaint waiting to happen"
  );

  // ---- The touch is wired where it actually fires -------------------------
  const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
  check(
    "the day is counted from the layout, not an auth sign-in event",
    /touchStreak\(/.test(layout),
    "sessions are JWTs, so signIn fires once and a streak would freeze at 1 forever"
  );
  check(
    "the layout compares the day key before doing any writing",
    /lastSeenDay !== todayStr\(\)/.test(layout),
    "this runs on every render; without the guard it is a write per page view"
  );

  // ---- Behaviour, against the real database ------------------------------
  const email = `streaktest-${Date.now()}@example.com`;
  const user = await prisma.user.create({ data: { email, name: "Streak Test" } });
  const made: string[] = [];
  try {
    const gv = await prisma.giveaway.create({
      data: {
        title: "Streak test giveaway",
        prize: "Test prize",
        endsAt: new Date(Date.now() + 7 * 864e5),
        status: "ACTIVE",
      },
    });
    made.push(gv.id);

    const first = await touchStreak(user.id);
    check("a first visit starts the streak at 1", first?.current === 1);
    check(
      "a first visit mints the daily entry",
      first?.entriesEarned === STREAK_ENTRIES_PER_DAY
    );

    const second = await touchStreak(user.id);
    check(
      "a second render the same day mints nothing",
      second?.entriesEarned === 0 && second?.current === 1,
      "the layout runs on every page view, so this is the load-bearing one"
    );

    // Hammer it the way a page with parallel renders would.
    const burst = await Promise.all(Array.from({ length: 8 }, () => touchStreak(user.id)));
    const mintedInBurst = burst.reduce((n, r) => n + (r?.entriesEarned ?? 0), 0);
    check("eight concurrent touches mint nothing extra", mintedInBurst === 0);

    const entries = await prisma.giveawayEntry.count({
      where: { giveawayId: gv.id, userId: user.id },
    });
    check(
      "exactly one day's worth of entries exists after all that",
      entries === STREAK_ENTRIES_PER_DAY,
      `found ${entries}`
    );
    const days = await prisma.loginDay.count({ where: { userId: user.id } });
    check("exactly one login day was recorded", days === 1, `found ${days}`);

    // Yesterday's row + a rewound user = tomorrow continues the run.
    await prisma.loginDay.deleteMany({ where: { userId: user.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenDay: dayBefore(today()), currentStreak: 4, longestStreak: 9 },
    });
    const cont = await touchStreak(user.id);
    check("visiting the day after yesterday continues the streak", cont?.current === 5);
    check("the longest streak is not lowered by a shorter current one", cont?.longest === 9);

    // A gap resets.
    await prisma.loginDay.deleteMany({ where: { userId: user.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenDay: dayBefore(dayBefore(today())), currentStreak: 12, longestStreak: 12 },
    });
    const broken = await touchStreak(user.id);
    check("missing a day resets the streak to 1", broken?.current === 1);
    check("but the best streak is remembered", broken?.longest === 12);

    // A milestone pays its bonus.
    const mile = STREAK_MILESTONES[0];
    await prisma.loginDay.deleteMany({ where: { userId: user.id } });
    await prisma.giveawayEntry.deleteMany({ where: { userId: user.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenDay: dayBefore(today()), currentStreak: mile.days - 1 },
    });
    const hit = await touchStreak(user.id);
    check(
      `hitting the ${mile.days}-day mark reports the milestone`,
      hit?.current === mile.days && hit?.milestone === mile.days
    );
    check(
      "and pays the bonus entries with it",
      hit?.entriesEarned === STREAK_ENTRIES_PER_DAY + mile.bonus
    );

    // No live giveaway: the streak still moves, nothing is minted. The
    // dev database carries its own seeded giveaway, so "none running"
    // has to be created rather than assumed — the first version of this
    // test closed only its own and passed against the seeded one.
    await prisma.giveaway.update({ where: { id: gv.id }, data: { status: "CLOSED" } });
    const others = await prisma.giveaway.findMany({
      where: { status: "ACTIVE", endsAt: { gt: new Date() } },
      select: { id: true },
    });
    await prisma.giveaway.updateMany({
      where: { id: { in: others.map((o) => o.id) } },
      data: { status: "CLOSED" },
    });
    try {
      await prisma.loginDay.deleteMany({ where: { userId: user.id } });
      await prisma.giveawayEntry.deleteMany({ where: { userId: user.id } });
      await prisma.user.update({
        where: { id: user.id },
        data: { lastSeenDay: dayBefore(today()), currentStreak: 2 },
      });
      const noGv = await touchStreak(user.id);
      check(
        "between giveaways the streak still climbs",
        noGv?.current === 3,
        "a gap in prizes must not punish somebody's twenty-day run"
      );
      check("but no entries are minted with nothing to enter", noGv?.entriesEarned === 0);
    } finally {
      // Put the site's own giveaway back exactly as it was.
      await prisma.giveaway.updateMany({
        where: { id: { in: others.map((o) => o.id) } },
        data: { status: "ACTIVE" },
      });
    }

    // A deleted account takes its streak history with it.
    await prisma.user.delete({ where: { id: user.id } });
    check(
      "deleting an account removes its login history",
      (await prisma.loginDay.count({ where: { userId: user.id } })) === 0,
      "right-to-delete has to reach every table, not just the obvious ones"
    );
  } finally {
    await prisma.loginDay.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.giveawayEntry.deleteMany({ where: { userId: user.id } }).catch(() => {});
    for (const id of made) {
      await prisma.giveawayEntry.deleteMany({ where: { giveawayId: id } }).catch(() => {});
      await prisma.giveaway.delete({ where: { id } }).catch(() => {});
    }
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }

  console.log(log.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
