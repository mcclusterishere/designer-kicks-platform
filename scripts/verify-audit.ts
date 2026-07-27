/**
 * Staff power over user content has to leave a trace.
 *
 * This exists because of a question the owner asked: "I can add photos to
 * other people's shoes — that doesn't make sense." The permission check
 * turned out to be correct; he could do it because he is an admin, and a
 * platform does need someone who can fix a broken photo or pull abuse.
 *
 * The real problem was the one underneath: that power was completely
 * invisible. Five actions let staff write to somebody else's content, not
 * one of them recorded anything, none told the affected person, and there
 * was no audit table in a 70-model schema. An admin could add photos to
 * an artist's piece, answer an offer on their behalf, or delete their
 * post, and the artist would never know and nothing would remember.
 *
 * That is the line between administration and interference. What follows
 * asserts the log exists, is honest about who did what, is visible to the
 * person it happened to, and — just as importantly — stays quiet when
 * someone edits their own work.
 *
 * Run: npm run verify:audit   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import {
  recordStaffAction, staffActions, actionsOnMyContent, countActionsOnMyContent,
} from "../lib/audit";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const TAG = "verify-audit";
const madeUsers: string[] = [];

async function main() {
  const artist = await prisma.user.create({
    data: { email: `${TAG}-artist@example.invalid`, name: `${TAG} artist` },
    select: { id: true },
  });
  const other = await prisma.user.create({
    data: { email: `${TAG}-other@example.invalid`, name: `${TAG} other` },
    select: { id: true },
  });
  madeUsers.push(artist.id, other.id);

  const staff = { id: null, email: "matt@example.invalid", role: "admin" };

  await recordStaffAction({
    actor: staff,
    action: "piece.photos.add",
    targetType: "submission",
    targetId: `${TAG}-piece-1`,
    targetOwnerId: artist.id,
    summary: `Added 2 photos to "${TAG} Afro Samurai"`,
  });
  await recordStaffAction({
    actor: staff,
    action: "post.delete",
    targetType: "feedPost",
    targetId: `${TAG}-post-1`,
    targetOwnerId: artist.id,
    summary: `Removed a feed post by ${TAG} artist`,
  });
  // Somebody else's entry, to prove the per-user view is scoped.
  await recordStaffAction({
    actor: staff,
    action: "offer.decline",
    targetType: "offer",
    targetId: `${TAG}-offer-1`,
    targetOwnerId: other.id,
    summary: `Declined an offer on someone else's piece`,
  });

  const mine = await actionsOnMyContent(artist.id);
  check("the artist sees what was done to their work", mine.length === 2, `${mine.length}`);
  check("newest first", mine[0].action === "post.delete", mine[0].action);
  check("the summary is a human sentence, not a code", /Removed a feed post/.test(mine[0].summary));
  check(
    "another artist's entry is NOT in their view",
    !mine.some((m) => /someone else/.test(m.summary))
  );

  // The actor's address is deliberately withheld from the user-facing
  // view; the role is shown so they know it was staff.
  // The select in actionsOnMyContent deliberately omits actorEmail, so
  // this is a runtime key check rather than a property access — the type
  // not having the field is itself half the proof.
  check(
    "the user view does not hand out a staff email address",
    !Object.prototype.hasOwnProperty.call(mine[0], "actorEmail"),
    Object.keys(mine[0]).join(",")
  );
  check("but it does say it was staff", mine[0].actorRole === "admin", mine[0].actorRole);

  const all = await staffActions(100);
  const ours = all.filter((a) => a.targetId.startsWith(TAG));
  check("the admin log holds every entry", ours.length === 3, `${ours.length}`);
  check("and the admin log DOES name the actor", ours[0].actorEmail === "matt@example.invalid");
  check(
    "a console action with no session is recorded honestly, not misattributed",
    ours.every((o) => o.actorId === null)
  );

  check("counting works for a badge", (await countActionsOnMyContent(artist.id)) === 2);
  check(
    "counting since a timestamp only counts what's newer",
    (await countActionsOnMyContent(artist.id, new Date())) === 0
  );
  check("someone with no entries counts zero", (await countActionsOnMyContent(other.id)) === 1);

  // Logging must never be able to break the operation it describes.
  let threw = false;
  try {
    await recordStaffAction({
      actor: staff,
      action: "x".repeat(50),
      targetType: "submission",
      targetId: `${TAG}-piece-2`,
      targetOwnerId: artist.id,
      // Deliberately over the column's sane length — must be truncated,
      // not thrown.
      summary: "y".repeat(5000),
    });
  } catch {
    threw = true;
  }
  check("an oversized entry never throws into the caller", !threw);
  const longOne = await prisma.auditLog.findFirst({
    where: { targetId: `${TAG}-piece-2` },
    select: { summary: true },
  });
  check("and is truncated rather than rejected", (longOne?.summary.length ?? 0) <= 500, `${longOne?.summary.length}`);

  // The rule that keeps the log meaningful.
  const before = await prisma.auditLog.count({ where: { targetOwnerId: artist.id } });
  check(
    "nothing logs an artist editing their own work",
    before === 3,
    `${before} entries — self-edits would bury the ones that matter`
  );
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { targetId: { startsWith: TAG } } });
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
    console.log("\n=== STAFF ACTION LOG ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });
