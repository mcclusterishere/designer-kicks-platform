/**
 * Folding two listings of one shoe into one, without losing anything.
 *
 * The mess this cleans up: while uploads were silently failing, artists
 * were told to re-post, and some did without deleting the first attempt.
 * One physical pair, two listings, photos split across both and the votes
 * stranded on whichever one came first.
 *
 * The dangerous instinct is to delete the spare. A Submission is the hub
 * of nine relations — votes, battle votes, outfit slots, offers, ratings,
 * consignment, predictions — most cascading, and Battle.subA/subB not
 * cascading at all. Deleting a duplicate that ever appeared in a battle
 * either destroys real history or leaves a battle pointing at a row that
 * no longer exists. So merging RETIRES the spare instead, and these checks
 * exist mostly to prove it never does anything worse than that.
 *
 * Run: npm run verify:dupes   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import { normalizeTitle, findDuplicatePieces, mergePieces } from "../lib/dupes";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const TAG = "verify-dupes";

async function artist(n: number) {
  const u = await prisma.user.create({
    data: { email: `${TAG}-${n}@example.invalid`, name: `${TAG} ${n}` },
    select: { id: true },
  });
  return prisma.artistProfile.create({
    data: { userId: u.id, displayName: `${TAG} ${n}`, slug: `${TAG}-${n}`, status: "APPROVED" },
    select: { id: true },
  });
}

async function piece(artistId: string, title: string, opts: Record<string, unknown> = {}) {
  return prisma.submission.create({
    data: {
      title: `${TAG} ${title}`,
      artistName: TAG,
      email: `${TAG}@example.invalid`,
      baseShoe: "Air Force 1",
      imageUrl: `/seed/${title.replace(/\W/g, "")}-cover.jpg`,
      status: "APPROVED",
      artistId,
      ...opts,
    },
    select: { id: true, title: true },
  });
}

async function main() {
  // ---- Title normalisation ------------------------------------------
  check("case and spacing don't matter", normalizeTitle("Afro Samurai") === normalizeTitle("afro   samurai"));
  check("punctuation doesn't matter", normalizeTitle("Sink-or-Swim!") === normalizeTitle("Sink or Swim"));
  check(
    "a re-upload marker is ignored",
    normalizeTitle("Treacherous Waters (re-upload)") === normalizeTitle("Treacherous Waters")
  );
  check("so is a v2 suffix", normalizeTitle("Trap House v2") === normalizeTitle("Trap House"));
  check(
    "but genuinely different names stay different",
    normalizeTitle("Afro Samurai") !== normalizeTitle("Afro Samurai Rising"),
    "matching these would merge two real pairs into one"
  );
  check(
    "a numbered series is NOT collapsed",
    normalizeTitle("Panel 1") !== normalizeTitle("Panel 2"),
    "an artist's series is not a duplicate"
  );

  // ---- Detection ------------------------------------------------------
  const a = await artist(1);
  const keep = await piece(a.id, "Treacherous Waters");
  const dupe = await piece(a.id, "Treacherous Waters (re-upload)", {
    imageUrl: "/seed/tw-new-cover.jpg",
    extraImages: ["/seed/tw-new-2.jpg", "/seed/tw-new-3.jpg"],
  });
  const unrelated = await piece(a.id, "Something Else Entirely");

  const groups = await findDuplicatePieces(a.id);
  check("the pair is spotted", groups.length === 1, `${groups.length} group(s)`);
  check("and it holds exactly the two", groups[0]?.pieces.length === 2);
  check(
    "the unrelated piece is left out",
    !groups.some((g) => g.pieces.some((p) => p.id === unrelated.id))
  );

  // Two different artists with the same obvious title is a coincidence.
  const b = await artist(2);
  await piece(b.id, "Treacherous Waters");
  const scoped = await findDuplicatePieces(a.id);
  check(
    "another artist's identical title is not in this artist's group",
    scoped[0]?.pieces.every((p) => p.id !== undefined) && scoped[0]?.pieces.length === 2,
    "merging across artists would erase authorship"
  );

  // ---- The merge -------------------------------------------------------
  const before = await prisma.submission.findUniqueOrThrow({
    where: { id: keep.id }, select: { extraImages: true },
  });
  const res = await mergePieces(keep.id, [dupe.id]);
  check("the merge succeeds", res.ok, res.ok ? "" : res.error);

  const after = await prisma.submission.findUniqueOrThrow({
    where: { id: keep.id },
    select: { imageUrl: true, extraImages: true, status: true },
  });
  const retired = await prisma.submission.findUniqueOrThrow({
    where: { id: dupe.id },
    select: { status: true, closetHidden: true, askingPriceCents: true, imageUrl: true },
  });

  check(
    "the duplicate still EXISTS — retired, not deleted",
    retired.status === "REJECTED",
    "deleting it would cascade away its votes, offers and ratings"
  );
  check("and is hidden from the artist's wall", retired.closetHidden === true);
  check("and off the market", retired.askingPriceCents === null);
  check("the survivor stays approved", after.status === "APPROVED");
  check(
    "every photo from the duplicate moved across",
    ["/seed/tw-new-cover.jpg", "/seed/tw-new-2.jpg", "/seed/tw-new-3.jpg"].every(
      (u) => after.imageUrl === u || after.extraImages.includes(u)
    ),
    `${after.extraImages.length} extras now (was ${before.extraImages.length})`
  );
  check(
    "the survivor keeps its own cover",
    after.imageUrl === "/seed/TreacherousWaters-cover.jpg",
    after.imageUrl
  );
  check("no photo is listed twice", new Set(after.extraImages).size === after.extraImages.length);

  // ---- What it refuses to do -------------------------------------------
  const other = await piece(b.id, "Treacherous Waters (dupe)");
  const cross = await mergePieces(keep.id, [other.id]);
  check(
    "it refuses to merge across artists",
    !cross.ok && /different artists/i.test(cross.ok ? "" : cross.error)
  );

  const collectorUser = await prisma.user.create({
    data: { email: `${TAG}-collector@example.invalid`, name: `${TAG} collector` },
    select: { id: true },
  });
  const owned = await piece(a.id, "Treacherous Waters (owned)", { ownerId: collectorUser.id });
  const ownedMerge = await mergePieces(keep.id, [owned.id]);
  check(
    "it refuses to retire a piece a collector owns",
    !ownedMerge.ok && /collector/i.test(ownedMerge.ok ? "" : ownedMerge.error),
    "retiring it would erase their record of owning it"
  );

  const sold = await piece(a.id, "Treacherous Waters (sold)");
  await prisma.sale.create({
    data: {
      submissionId: sold.id, sellerId: collectorUser.id,
      buyerEmail: `${TAG}-buyer@example.invalid`, priceCents: 10000,
      status: "CONFIRMED", soldAt: new Date(0),
    },
  });
  const soldMerge = await mergePieces(keep.id, [sold.id]);
  check("it refuses to retire a piece with a confirmed sale", !soldMerge.ok);

  const selfMerge = await mergePieces(keep.id, [keep.id]);
  check("merging a piece into itself does nothing", !selfMerge.ok);
  const ghost = await mergePieces(keep.id, ["no-such-piece-id"]);
  check("a missing piece is refused, not silently skipped", !ghost.ok);

  // Locked pieces are surfaced with a reason rather than hidden, so the
  // operator can see WHY one row in a group can't be folded in.
  const withLocked = await findDuplicatePieces(a.id);
  const lockedOnes = withLocked.flatMap((g) => g.pieces).filter((p) => p.locked);
  check(
    "owned/sold duplicates appear in the UI marked as locked",
    lockedOnes.length >= 2,
    lockedOnes.map((l) => l.locked).join("; ")
  );
}

async function cleanup() {
  const mine = await prisma.submission.findMany({
    where: { title: { startsWith: TAG } }, select: { id: true },
  });
  const ids = mine.map((m) => m.id);
  await prisma.sale.deleteMany({ where: { submissionId: { in: ids } } });
  await prisma.submission.deleteMany({ where: { id: { in: ids } } });
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
    console.log("\n=== SAME SHOE, POSTED TWICE ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });
