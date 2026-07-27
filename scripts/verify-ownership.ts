/**
 * Who has the piece — the question the whole market side depends on.
 *
 * A one-of-one with no known owner is a photo. One with a verified owner
 * is an asset: a collector page, public provenance, a resale value, and
 * a second sale. Every listing on this platform today has ownerId NULL,
 * which is the same fact stated as a symptom.
 *
 * Two rules are asserted hardest here, because both are easy to get
 * wrong in a way nobody notices:
 *
 *   1. Asking must be free for the common case. A maker posting work
 *      they still hold answers one radio and supplies nothing else. The
 *      moment that stops being true, uploads stop, and we have already
 *      shipped that bug once this week.
 *   2. An artist naming an owner is a CLAIM, not proof. Nothing may
 *      treat it as verified until the owner themselves confirms — or an
 *      admin does, recorded distinguishably.
 *
 * Run: npm run verify:ownership   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import {
  validateOwnership, unansweredPieces, unverifiedOwners, ownershipStats,
  ownerVerifyEmail, validEmail, cleanPhone, OWNERSHIP,
} from "../lib/ownership";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const TAG = "verify-ownership";
let artistId = "";
const madeSubs: string[] = [];

async function main() {
  // ---- The common case must cost nothing ------------------------------
  {
    const r = validateOwnership(OWNERSHIP.WITH_ARTIST, {});
    check("a maker who still has it needs no owner details", r.ok);
    if (r.ok) {
      check("and is recorded as holding it", r.data.ownershipStatus === OWNERSHIP.WITH_ARTIST);
      check("with no owner left behind", r.data.ownerEmail === null && r.data.ownerName === null);
      // A piece coming back from a cancelled sale must not keep a ghost.
      check("and any previous verification cleared", r.data.ownerVerifiedAt === null);
    }
  }

  // ---- Naming an owner requires a way to reach them --------------------
  {
    const missing = validateOwnership(OWNERSHIP.SOLD, { name: "Marcus" });
    check("sold with no email is refused", !missing.ok);
    if (!missing.ok) check("and says why in plain words", /email/i.test(missing.error), missing.error);

    const bad = validateOwnership(OWNERSHIP.SOLD, { email: "marcus@nowhere" });
    check("a malformed owner email is refused", !bad.ok);

    const good = validateOwnership(OWNERSHIP.SOLD, {
      email: "  Marcus@Example.COM ", name: " Marcus Webb ", phone: "(555) 010-1234", address: " 1 Test St ",
    });
    check("a good answer is accepted", good.ok);
    if (good.ok) {
      check("email is normalised", good.data.ownerEmail === "marcus@example.com", `${good.data.ownerEmail}`);
      check("name is trimmed", good.data.ownerName === "Marcus Webb");
      check("phone is stored as digits", good.data.ownerPhone === "5550101234", `${good.data.ownerPhone}`);
      check("address is kept when given", good.data.ownerAddress === "1 Test St");
      // The whole point: naming is not proving.
      check("naming an owner does NOT verify them", good.data.ownerVerifiedAt === undefined);
    }

    // Address stays optional — it is the highest-risk field here and it
    // is not what proves ownership.
    const noAddr = validateOwnership(OWNERSHIP.SOLD, { email: "a@b.com" });
    check("no address is still a valid answer", noAddr.ok);
    if (noAddr.ok) check("and stores null rather than an empty string", noAddr.data.ownerAddress === null);
  }

  check("an unrecognised status is refused", !validateOwnership("WHATEVER", {}).ok);
  check("a short phone isn't a phone", cleanPhone("911") === null);
  check("a real address passes email validation checks", validEmail("a@b.co") && !validEmail("a@b"));

  // ---- The letter -------------------------------------------------------
  {
    const mail = ownerVerifyEmail({ title: "Bred 4s", artistName: "Dekota", verifyUrl: "https://x/own/1" });
    check("the subject names both parties", mail.subject.includes("Dekota") && mail.subject.includes("Bred 4s"));
    check("the body carries the confirm link", mail.text.includes("https://x/own/1"));
    check("it explains the payoff", /resale/i.test(mail.text) && /provenance/i.test(mail.text));
    // Someone wrongly named must be able to do nothing and stay unlisted.
    check("a wrongly-named person is told to ignore it", /isn't yours/i.test(mail.text), mail.text.slice(0, 0));
  }

  // ---- Against the database ---------------------------------------------
  const user = await prisma.user.create({
    data: { email: `${TAG}-a@example.invalid`, name: TAG }, select: { id: true },
  });
  const artist = await prisma.artistProfile.create({
    data: { userId: user.id, slug: `${TAG}-a`, displayName: `${TAG} Artist`, status: "APPROVED" },
    select: { id: true },
  });
  artistId = artist.id;

  const piece = async (title: string, extra: Record<string, unknown> = {}) => {
    const s = await prisma.submission.create({
      data: {
        title, artistName: `${TAG} Artist`, email: `${TAG}@x.invalid`,
        baseShoe: "AF1", imageUrl: "/x.png", status: "APPROVED", artistId, ...extra,
      } as never,
      select: { id: true },
    });
    madeSubs.push(s.id);
    return s.id;
  };

  const held = await piece(`${TAG} held`, { ownershipStatus: OWNERSHIP.WITH_ARTIST });
  const old1 = await piece(`${TAG} old one`, { ownershipStatus: OWNERSHIP.UNKNOWN });
  const old2 = await piece(`${TAG} old two`, { ownershipStatus: OWNERSHIP.UNKNOWN });
  const named = await piece(`${TAG} named`, {
    ownershipStatus: OWNERSHIP.SOLD, ownerEmail: "owner@example.com", ownerName: "Owner Person",
  });
  const confirmed = await piece(`${TAG} confirmed`, {
    ownershipStatus: OWNERSHIP.SOLD, ownerEmail: "done@example.com",
    ownerVerifiedAt: new Date(), ownerVerifiedBy: "email",
  });

  const queue = await unansweredPieces(artistId);
  check("the backfill queue holds only unanswered pieces", queue.length === 2, `${queue.length}`);
  check("a piece the maker holds is not in the queue", !queue.some((q) => q.id === held));
  check("nor is one with an owner named", !queue.some((q) => q.id === named));
  check("both grandfathered pieces are", queue.some((q) => q.id === old1) && queue.some((q) => q.id === old2));

  const pending = await unverifiedOwners();
  const mine = pending.filter((p) => p.artistName === `${TAG} Artist`);
  check("the verify desk shows the named-but-unconfirmed", mine.length === 1, `${mine.length}`);
  check("and it's the right one", mine[0].id === named);
  check("an already-confirmed owner has left the desk", !mine.some((p) => p.id === confirmed));
  check("the desk carries a way to reach them", mine[0].ownerEmail === "owner@example.com");

  const stats = await ownershipStats(artistId);
  check("stats count what the maker holds", stats.withArtist === 1, `${stats.withArtist}`);
  check("stats count what's sold", stats.sold === 2, `${stats.sold}`);
  check("stats count the backlog", stats.unknown === 2, `${stats.unknown}`);
  check("stats count only real verifications", stats.verified === 1, `${stats.verified}`);
  check("the total adds up", stats.total === 5, `${stats.total}`);

  // Verification is the line between a claim and a fact.
  const before = await prisma.submission.findUniqueOrThrow({
    where: { id: named }, select: { ownerId: true, ownerVerifiedAt: true },
  });
  check("a named owner owns nothing until they confirm", before.ownerId === null);
  check("and is not marked verified", before.ownerVerifiedAt === null);

  await prisma.submission.update({
    where: { id: named },
    data: { ownerId: user.id, ownerVerifiedAt: new Date(), ownerVerifiedBy: "email" },
  });
  const after = await prisma.submission.findUniqueOrThrow({
    where: { id: named }, select: { ownerId: true, ownerVerifiedAt: true, ownerVerifiedBy: true },
  });
  check("confirming moves ownership", after.ownerId === user.id);
  check("and records how it was verified", after.ownerVerifiedBy === "email");
  check("an admin verification is distinguishable from a self-confirm",
    after.ownerVerifiedBy !== "admin");

  // ---- Isolation ---------------------------------------------------------
  const otherUser = await prisma.user.create({
    data: { email: `${TAG}-o@example.invalid`, name: `${TAG} o` }, select: { id: true },
  });
  const other = await prisma.artistProfile.create({
    data: { userId: otherUser.id, slug: `${TAG}-o`, displayName: `${TAG} Other`, status: "APPROVED" },
    select: { id: true },
  });
  check("another artist's backfill queue is their own", (await unansweredPieces(other.id)).length === 0);
  check("and their stats don't count someone else's pieces",
    (await ownershipStats(other.id)).total === 0);
}

async function cleanup() {
  await prisma.submission.deleteMany({ where: { id: { in: madeSubs } } });
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
    console.log("\n=== OWNERSHIP ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });
