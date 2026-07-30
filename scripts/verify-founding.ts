/**
 * The Founding 100 — exactly one hundred, exactly twelve months, once each.
 *
 * The first hundred artists who reach for Pro get it free for a year and a
 * number that says they were here first. Three things about that offer can
 * go wrong in ways nobody notices until it's embarrassing:
 *
 *   1. Handing out a hundred-and-first seat. "The Founding 100" is a
 *      promise with a number in it; the 101st artist reading their
 *      congratulations makes it a lie, and every earlier member's seat
 *      worth slightly less.
 *   2. Letting one artist take two, or double-tapping into two years.
 *   3. Any of it looking like a trial — a card on file, a subscription, a
 *      status that reads "active" to the revenue numbers. There is no
 *      money in this and nothing should claim otherwise.
 *
 * The cap is enforced by a UNIQUE index on foundingNumber rather than by a
 * count, which is the only way it survives two people tapping at once. The
 * concurrency check below is the one that actually matters.
 *
 * Run: npm run verify:founding   (dev database; every row it makes it deletes)
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import {
  claimFoundingSeat, foundingSeatsLeft, addMonths, foundingEmail,
  FOUNDING_SEATS, FOUNDING_MONTHS,
} from "../lib/founding";
import { isPro } from "../lib/plans";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const TAG = "verify-founding";

async function makeArtist(n: number, status = "APPROVED") {
  const u = await prisma.user.create({
    data: { email: `${TAG}-${n}@example.invalid`, name: `${TAG} ${n}` },
    select: { id: true },
  });
  return prisma.artistProfile.create({
    data: { userId: u.id, displayName: `${TAG} ${n}`, slug: `${TAG}-${n}`, status },
    select: { id: true },
  });
}

async function main() {
  // The dev database may already hold real seats; measure the room first
  // so the assertions are about what THIS run does, not absolute counts.
  const roomAtStart = await foundingSeatsLeft();
  check(
    "there is room to test with",
    roomAtStart >= 5,
    `${roomAtStart} seats free of ${FOUNDING_SEATS}`
  );

  // ---- One seat, done properly --------------------------------------
  const a1 = await makeArtist(1);
  const now = new Date("2026-07-26T12:00:00.000Z");
  const r1 = await claimFoundingSeat(a1.id, now);
  check("an approved artist gets a seat", r1.ok, r1.ok ? `#${r1.number}` : (r1 as { reason: string }).reason);
  if (!r1.ok) throw new Error("cannot continue without a seat");

  const row1 = await prisma.artistProfile.findUniqueOrThrow({
    where: { id: a1.id },
    select: {
      plan: true, planStatus: true, planPriceCents: true, planInterval: true,
      paidThrough: true, foundingNumber: true, foundingGrantedAt: true,
      stripeCustomerId: true, stripeSubscriptionId: true, firstSubscribedAt: true,
    },
  });

  check("the plan is really PRO", row1.plan === "PRO");
  check("and the entitlement gate agrees", isPro(row1, now));
  check(
    `it runs a full ${FOUNDING_MONTHS} months`,
    row1.paidThrough?.toISOString() === addMonths(now, FOUNDING_MONTHS).toISOString(),
    `${row1.paidThrough?.toISOString()}`
  );
  check("the price recorded is zero, not the list price", row1.planPriceCents === 0);
  check(
    "the status says 'founding', never 'active'",
    row1.planStatus === "founding",
    `${row1.planStatus} — 'active' would make the revenue numbers lie`
  );
  check("no billing interval, because nothing recurs", row1.planInterval === null);
  check(
    "no Stripe customer and no subscription exist",
    row1.stripeCustomerId === null && row1.stripeSubscriptionId === null,
    "nothing to cancel means nothing can silently start charging"
  );
  check("the cohort date is stamped", row1.firstSubscribedAt !== null);
  check("and the grant is dated", row1.foundingGrantedAt !== null);

  // ---- Claiming twice ------------------------------------------------
  const again = await claimFoundingSeat(a1.id, addMonths(now, 3));
  check("claiming again returns the same seat", again.ok && again.number === r1.number);
  check("and is marked as already held", again.ok && again.alreadyHad === true);
  const row2 = await prisma.artistProfile.findUniqueOrThrow({
    where: { id: a1.id }, select: { paidThrough: true },
  });
  check(
    "double-tapping does NOT buy a second year",
    row2.paidThrough?.toISOString() === row1.paidThrough?.toISOString(),
    "the expiry must not move"
  );

  // ---- Who cannot take one -------------------------------------------
  const pending = await makeArtist(2, "PENDING");
  const rp = await claimFoundingSeat(pending.id, now);
  check("an unapproved artist gets nothing", !rp.ok && rp.reason === "not-approved");

  const comped = await makeArtist(3);
  await prisma.artistProfile.update({
    where: { id: comped.id },
    data: { plan: "PRO", paidThrough: null }, // comped by hand: never expires
  });
  const rc = await claimFoundingSeat(comped.id, now);
  check(
    "a comped account doesn't burn a scarce seat",
    !rc.ok && rc.reason === "already-pro"
  );

  // An artist whose paid time already ran out is NOT already-pro, and
  // should be welcome — this is the lapsed case, not the active one.
  const lapsed = await makeArtist(4);
  await prisma.artistProfile.update({
    where: { id: lapsed.id },
    data: { plan: "PRO", paidThrough: new Date("2020-01-01T00:00:00.000Z") },
  });
  const rl = await claimFoundingSeat(lapsed.id, now);
  check("an expired plan can still claim a seat", rl.ok);

  // ---- The one that matters: two people, one seat --------------------
  const racers = await Promise.all([makeArtist(10), makeArtist(11), makeArtist(12), makeArtist(13)]);
  const before = await foundingSeatsLeft();
  const results = await Promise.all(racers.map((a) => claimFoundingSeat(a.id, now)));
  const granted = results.filter((r) => r.ok);
  const numbers = granted.map((r) => (r as { number: number }).number);
  check(
    "four simultaneous claims all succeed while there is room",
    granted.length === 4,
    `${granted.length}/4`
  );
  check(
    "and every one gets a DIFFERENT number",
    new Set(numbers).size === numbers.length,
    `#${numbers.sort((a, b) => a - b).join(" #")} — the unique index is what guarantees this`
  );
  const after = await foundingSeatsLeft();
  check("the room shrinks by exactly four", before - after === 4, `${before} → ${after}`);

  // ---- The hundred-and-first ----------------------------------------
  // Fill the room to the cap, then knock.
  const room = await foundingSeatsLeft();
  const fillers = [];
  for (let i = 0; i < room; i++) fillers.push(await makeArtist(100 + i));
  for (const f of fillers) await claimFoundingSeat(f.id, now);

  check("the room is now full", (await foundingSeatsLeft()) === 0);
  const taken = await prisma.artistProfile.count({ where: { foundingNumber: { not: null } } });
  check(
    `never more than ${FOUNDING_SEATS} seats exist`,
    taken === FOUNDING_SEATS,
    `${taken} claimed`
  );

  const latecomer = await makeArtist(9999);
  const rlate = await claimFoundingSeat(latecomer.id, now);
  check("the 101st artist is refused", !rlate.ok && rlate.reason === "full");
  const lateRow = await prisma.artistProfile.findUniqueOrThrow({
    where: { id: latecomer.id }, select: { plan: true, foundingNumber: true },
  });
  check(
    "and is left untouched — still FREE, still no number",
    lateRow.plan === "FREE" && lateRow.foundingNumber === null
  );

  // ---- The letter ----------------------------------------------------
  const mail = foundingEmail({
    artistName: "Dakota",
    number: 7,
    through: new Date("2027-07-26T12:00:00.000Z"),
    siteUrl: "https://theheatchart.com/",
  });
  check("the thank-you names their number", /#7/.test(mail.subject) && /#7/.test(mail.text));
  check("it states the end date in words", /July 26, 2027/.test(mail.text));
  check(
    "it never calls this a trial",
    !/trial/i.test(mail.subject) && !/trial/i.test(mail.text),
    "a trial is something you escape before it bills you; this bills nobody"
  );
  check(
    "it says plainly that nothing can charge them",
    /nothing to cancel/i.test(mail.text) && /never took a payment method/i.test(mail.text)
  );
  check("the Studio link has no double slash", /[^:]\/\/studio/.test(mail.text) === false);

  // ---- Month arithmetic ----------------------------------------------
  check(
    "a leap-day grant lands on Feb 28 the next year, not March 1",
    addMonths(new Date("2028-02-29T00:00:00.000Z"), 12).toISOString().startsWith("2029-02-28"),
    addMonths(new Date("2028-02-29T00:00:00.000Z"), 12).toISOString()
  );
  check(
    "the 31st of a month lands on the last day of a 30-day month",
    addMonths(new Date("2026-01-31T00:00:00.000Z"), 3).toISOString().startsWith("2026-04-30")
  );
  check(
    "an ordinary date is exactly a year later",
    addMonths(new Date("2026-07-26T12:00:00.000Z"), 12).toISOString() === "2027-07-26T12:00:00.000Z"
  );

  // ---- The charter ---------------------------------------------------
  // Two artists were already here before the offer existed, so the honest
  // count on day one is 98. The seed hands them #1 and #2 at deploy.
  // These assertions read the seed file rather than run it, because
  // running it would rewrite the whole development database.
  const seed = readFileSync("prisma/seed.mjs", "utf8");
  const charter = /const FOUNDING_CHARTER = \[([^\]]*)\]/.exec(seed)?.[1] ?? "";
  const slugs = [...charter.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  // An artist who has been renamed appears in the charter under both
  // addresses, because a live database may still be on the old one when
  // this runs and the seat must be found either way. That is two entries
  // for one person, so the count that matters is of PEOPLE — resolved
  // through the same alias map the artist page redirects with, which also
  // stops the two lists drifting apart.
  const page = readFileSync("app/artists/[slug]/page.tsx", "utf8");
  const aliasBlock = /const SLUG_ALIASES: Record<string, string> = \{([\s\S]*?)\n\};/.exec(page)?.[1] ?? "";
  const aliases = new Map(
    [...aliasBlock.matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((m) => [m[1], m[2]])
  );
  const people = new Set(slugs.map((s) => aliases.get(s) ?? s));

  check("the charter names exactly two artists", people.size === 2, [...people].join(", "));
  check(
    "every extra entry is a retired address of one of them, not a third person",
    slugs.every((s) => people.has(s) || aliases.get(s) !== undefined),
    "an unaliased third slug would quietly seat somebody nobody agreed to"
  );
  check(
    "a retired address in the charter still redirects on the public page",
    slugs.filter((s) => !people.has(s)).every((s) => aliases.get(s) !== undefined),
    "otherwise the seat is granted to a page whose URL 404s"
  );
  check(
    "and it identifies them by SLUG, never by display name",
    slugs.every((s) => /^[a-z0-9-]+$/.test(s)),
    "a display name is free text the holder can change; a slug is not"
  );
  check(
    "the charter is applied at boot",
    /await grantFoundingCharter\(\);/.test(seed)
  );
  check(
    "granting is skipped for anyone who already holds a seat",
    /a\.foundingNumber !== null/.test(seed),
    "otherwise every deploy would silently extend their year"
  );
  check(
    "the seed refuses to exceed the cap",
    /taken >= 100/.test(seed)
  );
  check(
    "and retries on the unique-index collision rather than throwing",
    /P2002/.test(seed)
  );

  // The seed restates lib/founding's rules because plain ESM can't import
  // TypeScript. Assert the restatement still matches, so the duplication
  // is checked rather than trusted.
  check(
    "the seed grants the same 12 months this module does",
    /addMonthsSeed\(now, 12\)/.test(seed) && FOUNDING_MONTHS === 12
  );
  check("the seed grants at price zero", /planPriceCents: 0/.test(seed));
  check('the seed uses status "founding", not "active"', /planStatus: "founding"/.test(seed));
  check(
    "the seed clamps months the same way, so no grant is a day short",
    /lastDay = new Date\(Date\.UTC/.test(seed)
  );

  // ---- Being thanked --------------------------------------------------
  // A granted seat involves no click, so the note cannot depend on the
  // redirect or the two people it is most owed to would never see it.
  const studio = readFileSync("app/studio/page.tsx", "utf8");
  check(
    "the thank-you shows for any unthanked founding member",
    /profile\.foundingNumber && !profile\.foundingThankedAt/.test(studio),
    "not gated on the ?founding= redirect"
  );
  check("and it can be dismissed", /acknowledgeFounding/.test(studio));
  const billing = readFileSync("app/billing-actions.ts", "utf8");
  check(
    "dismissing is scoped to the caller's own profile",
    /userId: session\.user\.id, foundingNumber: \{ not: null \}, foundingThankedAt: null/.test(billing)
  );
}

async function cleanup() {
  await prisma.artistProfile.deleteMany({ where: { slug: { startsWith: TAG } } });
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
    console.log("\n=== THE FOUNDING 100 ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });
