/**
 * Subscription metrics, recomputed by hand.
 *
 * These are the numbers that go in front of an investor, and every one of
 * them has a flattering version that's wrong. MRR that counts cancelled
 * subscribers still inside their period. Annual plans booked as if they
 * were monthly. Churn measured against everyone who ever signed up.
 * "Users" that are really unclaimed pages we made ourselves.
 *
 * Each of those is asserted against here, in the wrong direction as well
 * as the right one — a metric that can only be checked for being too low
 * isn't being checked.
 *
 * Run: npm run verify:saas   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import { saasMetrics, monthlyValueCents, monthsToGoal } from "../lib/saas";
import { isPro, can, needsAttention, daysLeft, yearlyMonthsFree } from "../lib/plans";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const TAG = "verify-saas";
const DAY = 86400000;
const ago = (d: number) => new Date(Date.now() - d * DAY);
const ahead = (d: number) => new Date(Date.now() + d * DAY);

async function main() {
  // ---- Entitlement, with no database at all -------------------------
  const base = { plan: "PRO", planStatus: "active", paidThrough: ahead(20) };
  check("an active subscriber is PRO", isPro(base));
  check("and can reach a paid feature", can(base, "contacts"));

  check(
    "a free artist is not PRO",
    !isPro({ plan: "FREE", planStatus: null, paidThrough: null })
  );
  check(
    "a free artist cannot reach a paid feature",
    !can({ plan: "FREE", planStatus: null, paidThrough: null }, "inventory")
  );
  check("nobody at all is not PRO", !isPro(null) && !can(null, "contacts"));

  // The two cases that decide whether billing feels fair.
  check(
    "a failed card does NOT lock them out while Stripe retries",
    isPro({ plan: "PRO", planStatus: "past_due", paidThrough: ahead(10) }),
    "past_due inside the paid period"
  );
  check(
    "but it is flagged for attention",
    needsAttention({ plan: "PRO", planStatus: "past_due", paidThrough: ahead(10) })
  );
  check(
    "someone who cancelled keeps what they paid for",
    isPro({ plan: "PRO", planStatus: "canceled", paidThrough: ahead(5) })
  );
  check(
    "and loses it when the period actually ends",
    !isPro({ plan: "PRO", planStatus: "canceled", paidThrough: ago(1) })
  );
  check(
    "an expired plan is closed even if Stripe still says active",
    !isPro({ plan: "PRO", planStatus: "active", paidThrough: ago(1) }),
    "paidThrough is the authority"
  );
  check(
    "a comped account with no end date stays open",
    isPro({ plan: "PRO", planStatus: null, paidThrough: null })
  );

  check("days left counts forward", daysLeft({ plan: "PRO", planStatus: "active", paidThrough: ahead(9) }) === 9);
  check("an expired plan reports zero days, not negative", daysLeft({ plan: "PRO", planStatus: "active", paidThrough: ago(9) }) === 0);

  // ---- Normalising intervals -----------------------------------------
  check("a monthly plan is its own price", monthlyValueCents(2900, "month") === 2900);
  check("an annual plan is divided by twelve", monthlyValueCents(29000, "year") === Math.round(29000 / 12));
  check("an annual plan is NOT booked as a full month", monthlyValueCents(29000, "year") !== 29000);
  check("a missing price is zero, not NaN", monthlyValueCents(null, "month") === 0);
  check("the yearly saving is stated in whole months", yearlyMonthsFree() === 2, `${yearlyMonthsFree()}`);

  // ---- Against the database -------------------------------------------
  const mk = async (
    n: string,
    opts: {
      claimed?: boolean;
      pieces?: boolean;
      plan?: string;
      status?: string | null;
      price?: number | null;
      interval?: string | null;
      paidThrough?: Date | null;
      firstAt?: Date | null;
    } = {}
  ) => {
    const user = await prisma.user.create({
      data: {
        email: `${TAG}-${n}@example.invalid`,
        name: `${TAG} ${n}`,
        // A password is what makes a page "claimed" — a page we created
        // for someone who never logged in has none.
        passwordHash: opts.claimed ? "$2b$10$notarealhashjustapresencemarker" : null,
      },
      select: { id: true },
    });
    const a = await prisma.artistProfile.create({
      data: {
        userId: user.id,
        slug: `${TAG}-${n}`,
        displayName: `${TAG} ${n}`,
        status: "APPROVED",
        plan: opts.plan ?? "FREE",
        planStatus: opts.status ?? null,
        planPriceCents: opts.price ?? null,
        planInterval: opts.interval ?? null,
        paidThrough: opts.paidThrough ?? null,
        firstSubscribedAt: opts.firstAt ?? null,
      },
      select: { id: true },
    });
    if (opts.pieces) {
      await prisma.submission.create({
        data: {
          title: `${TAG} ${n} piece`, artistName: `${TAG} ${n}`, email: `${TAG}@example.invalid`,
          baseShoe: "AF1", imageUrl: "/x.png", status: "APPROVED", artistId: a.id,
        },
      });
    }
    return a.id;
  };

  const before = await saasMetrics();

  // A roster that looks like a real early-stage one: mostly pages we made.
  await mk("unclaimed-1");
  await mk("unclaimed-2");
  await mk("claimed-lurker", { claimed: true });
  await mk("claimed-active", { claimed: true, pieces: true });
  // Two paying: one monthly, one annual.
  await mk("pays-monthly", {
    claimed: true, pieces: true, plan: "PRO", status: "active",
    price: 2900, interval: "month", paidThrough: ahead(20), firstAt: ago(90),
  });
  await mk("pays-yearly", {
    claimed: true, pieces: true, plan: "PRO", status: "active",
    price: 29000, interval: "year", paidThrough: ahead(300), firstAt: ago(200),
  });
  // Cancelled but still inside their period: keeps access, out of MRR.
  await mk("winding-down", {
    claimed: true, plan: "PRO", status: "canceled",
    price: 2900, interval: "month", paidThrough: ahead(8), firstAt: ago(120),
  });
  // Card failed, Stripe retrying: keeps access, counted, flagged.
  await mk("card-failed", {
    claimed: true, plan: "PRO", status: "past_due",
    price: 2900, interval: "month", paidThrough: ahead(4), firstAt: ago(60),
  });
  // Long gone: no access, no MRR.
  await mk("long-gone", {
    claimed: true, plan: "PRO", status: "canceled",
    price: 2900, interval: "month", paidThrough: ago(40), firstAt: ago(400),
  });

  const m = await saasMetrics();
  const d = <K extends keyof typeof m>(k: K) => (m[k] as number) - (before[k] as number);

  check("every page is counted as a page", d("pages") === 9, `${d("pages")}`);
  check("unclaimed pages are NOT counted as claimed", d("claimed") === 7, `${d("claimed")}`);
  check("a page we made for someone is not a user", d("pages") > d("claimed"));
  // Three of the nine are claimed AND have posted: claimed-active,
  // pays-monthly, pays-yearly. The lurker and the three billing-state
  // fixtures are claimed but have posted nothing, which is the exact
  // distinction this metric exists to draw.
  check("active means claimed AND posting", d("active") === 3, `${d("active")}`);
  check("active is a subset of claimed", d("active") < d("claimed"), `${d("active")} of ${d("claimed")}`);

  // MRR: monthly 2900 + annual 29000/12 (2417) + past_due 2900 = 8217.
  // The cancelled-but-current one is excluded; the long-gone one too.
  const wantMrr = 2900 + Math.round(29000 / 12) + 2900;
  check("MRR totals by hand", d("mrrCents") === wantMrr, `${d("mrrCents")} vs ${wantMrr}`);
  check("a cancelled subscriber is out of MRR even with access left", d("mrrCents") < wantMrr + 2900);
  check("a past-due subscriber is still in MRR", d("mrrCents") >= 2900 * 2);
  check("three subscriptions are live", d("paying") === 3, `${d("paying")}`);
  check("the winding-down one is counted separately", d("windingDown") === 1, `${d("windingDown")}`);
  check("the failed card is flagged at risk", d("atRisk") === 1, `${d("atRisk")}`);
  check("run rate is MRR × 12, not a revenue claim", m.runRateCents === m.mrrCents * 12);
  check(
    "ARPU divides MRR by live subscribers only",
    m.paying === 0 || m.arpuCents === Math.round(m.mrrCents / m.paying),
    `${m.arpuCents}`
  );
  check("claim rate is below 100% on this roster", m.claimRatePct < 100, `${m.claimRatePct}%`);
  check("conversion measures against claimed, not pages", m.conversionPct > (m.paying / m.pages) * 100);

  // ---- The runway question --------------------------------------------
  check("a $2,500 goal at $87/mo takes 29 months", monthsToGoal(8700, 250000) === 29, `${monthsToGoal(8700, 250000)}`);
  check("zero MRR reports never, not a fantasy date", monthsToGoal(0, 250000) === null);
  check(
    "margin is taken off before the maths",
    monthsToGoal(10000, 100000, 50) === 20,
    `${monthsToGoal(10000, 100000, 50)}`
  );
}

async function cleanup() {
  await prisma.submission.deleteMany({ where: { artistName: { startsWith: TAG } } });
  await prisma.artistProfile.deleteMany({ where: { displayName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
}

main()
  .catch((e) => {
    fail++;
    log.push(`FAIL threw — ${e instanceof Error ? e.message : String(e)}`);
  })
  .then(cleanup)
  .finally(async () => {
    await prisma.$disconnect();
    console.log("\n=== SUBSCRIPTION METRICS ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });
