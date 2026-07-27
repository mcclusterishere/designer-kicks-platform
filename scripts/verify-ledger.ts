/**
 * Proof that the credit ledger holds.
 *
 * Run: npm run verify:ledger
 *
 * These are the properties a regulator, an auditor, or an angry member with
 * a screenshot would actually test. They are cheap to assert and expensive
 * to discover the hard way, so they get asserted on demand rather than
 * assumed.
 *
 * The script creates its own throwaway members, does its damage to them,
 * and deletes them on the way out. It never touches a real balance.
 */
import { prisma } from "../lib/db";
import { postCredits, reconcile, statement, stakedToday } from "../lib/ledger";
import { consumeStrike, todayStr, FREE_STRIKES_PER_DAY } from "../lib/quiz";

const results: string[] = [];
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed++;
}

let n = 0;
/**
 * A member starts at zero and is funded through the ledger, never by writing
 * a balance in directly — otherwise every one of them is born drifted and
 * the reconciliation checks below would only be measuring the test's own
 * shortcut. (Real accounts start at zero too: User.credits defaults to 0.)
 */
async function makeMember(credits: number) {
  n += 1;
  const u = await prisma.user.create({
    data: {
      email: `ledger-verify-${process.pid}-${n}@example.invalid`,
      name: `Ledger Verify ${n}`,
    },
    select: { id: true },
  });
  if (credits > 0) {
    const seed = await postCredits({ userId: u.id, delta: credits, reason: "verify-seed" });
    if (!seed.ok) throw new Error(`could not seed member: ${seed.detail}`);
  }
  return u;
}

/** Balance the ledger says they have, independent of the stored number. */
async function ledgerSum(userId: string) {
  const agg = await prisma.creditTransaction.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}

async function stored(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { credits: true } });
  return u.credits;
}

async function main() {
  const created: string[] = [];
  const track = <T extends { id: string }>(u: T) => {
    created.push(u.id);
    return u;
  };

  try {
    // ---------------------------------------------------------------
    // 1. A movement writes the balance and the entry together, and the
    //    entry carries the balance that resulted.
    // ---------------------------------------------------------------
    const a = track(await makeMember(0));
    const credit = await postCredits({ userId: a.id, delta: 100, reason: "verify-grant" });
    check("credit in succeeds", credit.ok, credit.ok ? `balance ${credit.balance}` : credit.detail);
    check("balance moved", (await stored(a.id)) === 100);
    check("entry logged", (await ledgerSum(a.id)) === 100);
    const [firstEntry] = await statement(a.id, 1);
    check(
      "entry stamps balanceAfter",
      firstEntry?.balanceAfter === 100,
      `got ${firstEntry?.balanceAfter}`
    );

    // ---------------------------------------------------------------
    // 2. You cannot spend what you do not have. The balance is untouched
    //    and no entry is written for the attempt.
    // ---------------------------------------------------------------
    const over = await postCredits({ userId: a.id, delta: -500, reason: "call-stake" });
    check("overdraft refused", !over.ok && over.reason === "insufficient", JSON.stringify(over));
    check("overdraft left balance alone", (await stored(a.id)) === 100);
    check("overdraft wrote no entry", (await ledgerSum(a.id)) === 100);

    // ---------------------------------------------------------------
    // 3. Two spends of the same balance at the same instant. The whole
    //    point: the loser must lose at the database, not in application
    //    memory, and the balance must land at 0 rather than negative.
    // ---------------------------------------------------------------
    const b = track(await makeMember(50));
    const race = await Promise.all([
      postCredits({ userId: b.id, delta: -50, reason: "call-stake" }),
      postCredits({ userId: b.id, delta: -50, reason: "call-stake" }),
    ]);
    const won = race.filter((r) => r.ok).length;
    check("concurrent double-spend: exactly one wins", won === 1, `${won} succeeded`);
    check("concurrent double-spend: balance is 0 not -50", (await stored(b.id)) === 0);
    check("concurrent double-spend: ledger agrees", (await ledgerSum(b.id)) === 0);

    // ---------------------------------------------------------------
    // 4. Idempotency. A settlement job that times out and retries must
    //    pay once. Twenty concurrent replays of one key: one payment.
    // ---------------------------------------------------------------
    const c = track(await makeMember(0));
    const key = `verify-payout:${process.pid}`;
    const replays = await Promise.all(
      Array.from({ length: 20 }, () =>
        postCredits({ userId: c.id, delta: 25, reason: "call-payout", idempotencyKey: key })
      )
    );
    const allOk = replays.every((r) => r.ok);
    check("every replay reports success", allOk);
    check("replayed payout paid once", (await stored(c.id)) === 25, `balance ${await stored(c.id)}`);
    const entries = await prisma.creditTransaction.count({ where: { userId: c.id } });
    check("replayed payout wrote one entry", entries === 1, `${entries} entries`);

    // A later, sequential replay of the same key is also a no-op.
    await postCredits({ userId: c.id, delta: 25, reason: "call-payout", idempotencyKey: key });
    check("late replay is still a no-op", (await stored(c.id)) === 25);

    // ---------------------------------------------------------------
    // 5. Reconciliation notices drift. Corrupt a balance behind the
    //    ledger's back and confirm the check catches it — a reconciler
    //    that never fires is not a reconciler.
    // ---------------------------------------------------------------
    const before = await reconcile();
    check("clean books reconcile", !before.drifted.some((d) => created.includes(d.userId)),
      JSON.stringify(before.drifted.filter((d) => created.includes(d.userId))));

    await prisma.user.update({ where: { id: c.id }, data: { credits: { increment: 999 } } });
    const after = await reconcile();
    const caught = after.drifted.find((d) => d.userId === c.id);
    check("reconcile catches injected drift", caught?.diff === 999, `diff ${caught?.diff}`);
    await prisma.user.update({ where: { id: c.id }, data: { credits: { decrement: 999 } } });

    // ---------------------------------------------------------------
    // 6. Daily stake limit. Caps risk, never a refund or a payout.
    // ---------------------------------------------------------------
    const d = track(await makeMember(1000));
    await prisma.user.update({ where: { id: d.id }, data: { dailyStakeLimit: 30 } });
    const s1 = await postCredits({ userId: d.id, delta: -25, reason: "call-stake" });
    check("stake under the limit goes through", s1.ok);
    const s2 = await postCredits({ userId: d.id, delta: -25, reason: "call-stake" });
    check("stake over the limit is refused", !s2.ok && s2.reason === "limit", JSON.stringify(s2));
    check("staked-today counts correctly", (await stakedToday(d.id)) === 25);
    const refund = await postCredits({
      userId: d.id, delta: 25, reason: "call-stake-refund", bypassLimits: true,
    });
    check("refund is not blocked by the limit", refund.ok);
    const payout = await postCredits({ userId: d.id, delta: 500, reason: "call-payout" });
    check("payout is not blocked by the limit", payout.ok);

    // ---------------------------------------------------------------
    // 7. Self-exclusion. While a break is on, nothing may be risked —
    //    but money already owed still lands.
    // ---------------------------------------------------------------
    const e = track(await makeMember(500));
    await prisma.user.update({
      where: { id: e.id },
      data: { selfExcludedUntil: new Date(Date.now() + 86_400_000) },
    });
    const blocked = await postCredits({ userId: e.id, delta: -10, reason: "call-stake" });
    check("self-exclusion blocks a stake", !blocked.ok && blocked.reason === "excluded", JSON.stringify(blocked));
    const settle = await postCredits({
      userId: e.id, delta: 40, reason: "call-payout", idempotencyKey: `verify-settle:${process.pid}`,
    });
    check("self-exclusion still lets a payout land", settle.ok);
    check("excluded member's balance is right", (await stored(e.id)) === 540);

    // An expired break stops blocking on its own.
    await prisma.user.update({
      where: { id: e.id },
      data: { selfExcludedUntil: new Date(Date.now() - 1000) },
    });
    const unblocked = await postCredits({ userId: e.id, delta: -10, reason: "call-stake" });
    check("an expired break no longer blocks", unblocked.ok, JSON.stringify(unblocked));

    // ---------------------------------------------------------------
    // 8. Nonsense in, refusal out — and never a silent write.
    // ---------------------------------------------------------------
    const zero = await postCredits({ userId: e.id, delta: 0, reason: "verify-zero" });
    check("zero movement refused", !zero.ok);
    const frac = await postCredits({ userId: e.id, delta: 1.5, reason: "verify-fraction" });
    check("fractional credit refused", !frac.ok);

    // ---------------------------------------------------------------
    // 9. Whole-population invariant: every member this script touched
    //    has a stored balance equal to the sum of their own entries.
    // ---------------------------------------------------------------
    // ---------------------------------------------------------------
    // 9. The strike path, which spends credits as one half of a bigger
    //    unit of work and so joins the caller's transaction rather than
    //    opening its own. Two wrong answers landing at the same instant
    //    on a one-credit balance: one strike, no negative.
    // ---------------------------------------------------------------
    const f = track(await makeMember(1));
    await prisma.user.update({
      where: { id: f.id },
      data: { freeStrikesDate: todayStr(), freeStrikesUsed: FREE_STRIKES_PER_DAY },
    });
    const strikes = await Promise.all([consumeStrike(f.id), consumeStrike(f.id)]);
    const paidStrikes = strikes.filter((s) => s === "paid").length;
    check("concurrent strikes: exactly one is paid", paidStrikes === 1, JSON.stringify(strikes));
    check("concurrent strikes: balance is 0 not -1", (await stored(f.id)) === 0);
    const brokeStrike = await consumeStrike(f.id);
    check("a broke member gets no strike", brokeStrike === null, String(brokeStrike));

    // Free strikes come first and cost nothing.
    const g = track(await makeMember(1));
    const freeStrike = await consumeStrike(g.id);
    check("free strikes are spent before credits", freeStrike === "free", String(freeStrike));
    check("a free strike costs no credits", (await stored(g.id)) === 1);

    for (const id of created) {
      const [s, l] = await Promise.all([stored(id), ledgerSum(id)]);
      check(`final invariant ${id.slice(0, 8)}: stored == ledger`, s === l, `${s} vs ${l}`);
    }

    // ---------------------------------------------------------------
    // 10. And the same invariant across the real population. This is the
    //     one that matters: the nightly refresh runs reconcile() and
    //     raises on any drift, so pre-existing drift here is a live
    //     problem, not a test artefact.
    // ---------------------------------------------------------------
    const whole = await reconcile();
    const real = whole.drifted.filter((d) => !created.includes(d.userId));
    check(
      `whole population reconciles (${whole.checked} members)`,
      real.length === 0,
      real.length ? JSON.stringify(real.slice(0, 5)) : ""
    );
  } finally {
    if (created.length) {
      await prisma.creditTransaction.deleteMany({ where: { userId: { in: created } } });
      await prisma.user.deleteMany({ where: { id: { in: created } } });
    }
  }

  console.log(results.join("\n"));
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
