/**
 * Nobody edits anybody else's work.
 *
 * This exists because of one observation from the owner: "I can add
 * photos to other people's shoes — that doesn't make sense." The photo
 * action turned out to be correctly gated; he could do it because he is
 * an admin. But going looking turned up five places where the gate was
 * genuinely open, and four of them shared a single mistaken idea:
 *
 *   that having made a piece is the same as having a say over it.
 *
 * It isn't. `artistId` is a credit line and it is permanent. `ownerId` is
 * the thing that moves. Once a one-of-one is in a collector's closet, the
 * maker's name stays on it forever and their authority over it ends —
 * they don't get to re-price it, rewrite it, re-point who owns it, or
 * delete it and take the collector's sale record down in the cascade.
 *
 * The fifth was the same error wearing different clothes: an email typed
 * into an unauthenticated form was being treated as proof of who typed
 * it, which let a stranger adopt a staff account at signup and let anyone
 * overwrite somebody else's pending claim.
 *
 * Each check below states an attack, and passes only when it fails. Where
 * it's cheap to do so, the check also asserts that the OLD scope would
 * have allowed it — a regression test that can't tell you what it caught
 * is just a green tick.
 *
 * Run: npm run verify:authz   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import { stillHeldBy, holderOf } from "../lib/ownership";
import { mayAdoptExistingAccount, provesEmail, isStaffRole } from "../lib/authz";
import { cronKeyAccepted } from "../lib/cronAuth";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const TAG = "verify-authz";

async function main() {
  // ---- Cast -------------------------------------------------------
  // A maker, a collector who bought from them, and a second maker who
  // has nothing to do with any of it.
  const makerUser = await prisma.user.create({
    data: { email: `${TAG}-maker@example.invalid`, name: `${TAG} maker` },
    select: { id: true },
  });
  const collector = await prisma.user.create({
    data: { email: `${TAG}-collector@example.invalid`, name: `${TAG} collector` },
    select: { id: true },
  });
  const strangerUser = await prisma.user.create({
    data: { email: `${TAG}-stranger@example.invalid`, name: `${TAG} stranger` },
    select: { id: true },
  });
  const maker = await prisma.artistProfile.create({
    data: {
      userId: makerUser.id,
      displayName: `${TAG} Maker`,
      slug: `${TAG}-maker`,
      status: "APPROVED",
    },
    select: { id: true },
  });
  const stranger = await prisma.artistProfile.create({
    data: {
      userId: strangerUser.id,
      displayName: `${TAG} Stranger`,
      slug: `${TAG}-stranger`,
      status: "APPROVED",
    },
    select: { id: true },
  });

  const piece = (title: string, extra: Record<string, unknown> = {}) =>
    prisma.submission.create({
      data: {
        title: `${TAG} ${title}`,
        artistName: `${TAG} Maker`,
        email: `${TAG}-maker@example.invalid`,
        baseShoe: "Air Force 1",
        imageUrl: "/x.jpg",
        status: "APPROVED",
        artistId: maker.id,
        ...extra,
      },
      select: { id: true },
    });

  // Still in the maker's hands.
  const held = await piece("Held");
  // Sold on-platform and claimed: owner set.
  const sold = await piece("Sold", { ownerId: collector.id, askingPriceCents: 40000 });
  await prisma.sale.create({
    data: {
      submissionId: sold.id,
      sellerId: makerUser.id,
      buyerId: collector.id,
      buyerEmail: `${TAG}-collector@example.invalid`,
      priceCents: 40000,
      status: "CONFIRMED",
      soldAt: new Date(0),
    },
  });
  // Sold, then the collector deleted their account — `ownerId` SetNull.
  // The pair does not come back to the person who made it.
  const orphaned = await piece("Orphaned");
  await prisma.sale.create({
    data: {
      submissionId: orphaned.id,
      sellerId: makerUser.id,
      buyerEmail: `${TAG}-ghost@example.invalid`,
      priceCents: 30000,
      status: "CONFIRMED",
      soldAt: new Date(0),
    },
  });
  // Sold off-platform: the maker named an owner, who then confirmed.
  const offPlatform = await piece("OffPlatform", {
    ownershipStatus: "SOLD",
    ownerEmail: `${TAG}-collector@example.invalid`,
    ownerVerifiedAt: new Date(0),
    ownerVerifiedBy: "email",
  });

  const matches = async (artistId: string, pieceId: string) =>
    (await prisma.submission.count({ where: stillHeldBy(artistId, pieceId) })) === 1;
  /** What the code did before the fix: artistId and nothing else. */
  const oldScopeMatches = async (artistId: string, pieceId: string) =>
    (await prisma.submission.count({ where: { id: pieceId, artistId } })) === 1;

  // ---- The scope --------------------------------------------------
  check("a maker can still act on a piece they're holding", await matches(maker.id, held.id));

  check(
    "a maker CANNOT act on a pair sitting in a collector's closet",
    !(await matches(maker.id, sold.id))
  );
  check(
    "…and the old artistId-only scope would have let them",
    await oldScopeMatches(maker.id, sold.id),
    "if this fails the regression test is testing nothing"
  );

  check(
    "a collector deleting their account does not hand the pair back",
    !(await matches(maker.id, orphaned.id)),
    "CONFIRMED sale, ownerId SetNull to null"
  );
  check(
    "…and the old scope would have handed it back",
    await oldScopeMatches(maker.id, orphaned.id)
  );

  check(
    "another artist's piece is not reachable at all",
    !(await matches(stranger.id, held.id))
  );
  check("an empty piece id matches nothing", !(await matches(maker.id, "")));
  check(
    "a well-formed id for a piece that doesn't exist matches nothing",
    !(await matches(maker.id, `${TAG}-no-such-piece`))
  );

  // ---- What the scope is protecting -------------------------------
  // deleteMyPiece cascades. This is the blast radius it used to have.
  const doomed = await prisma.submission.deleteMany({ where: stillHeldBy(maker.id, sold.id) });
  check(
    "deleting through the scope cannot touch a sold piece",
    doomed.count === 0,
    `${doomed.count} rows`
  );
  check(
    "so the collector's CONFIRMED sale survives",
    (await prisma.sale.count({ where: { submissionId: sold.id, status: "CONFIRMED" } })) === 1
  );

  // updateMyPiece wrote askingPriceCents directly, bypassing both gates
  // setAskingPrice enforces (must be the owner, sale must be verified).
  const repriced = await prisma.submission.updateMany({
    where: stillHeldBy(maker.id, sold.id),
    data: { askingPriceCents: 1 },
  });
  check("and the maker cannot re-price it either", repriced.count === 0);
  check(
    "the collector's ask is untouched",
    (await prisma.submission.findUnique({ where: { id: sold.id }, select: { askingPriceCents: true } }))
      ?.askingPriceCents === 40000
  );

  // setOwnershipAction adds ownerVerifiedAt: null on top of the scope,
  // because naming an owner is one step from becoming one — /own/[id]
  // lets the named address confirm, and confirming writes ownerId.
  const repointed = await prisma.submission.count({
    where: { ...stillHeldBy(maker.id, offPlatform.id), ownerVerifiedAt: null },
  });
  check("a confirmed ownership record can't be re-pointed by the maker", repointed === 0);
  const stillOpen = await prisma.submission.count({
    where: { ...stillHeldBy(maker.id, held.id), ownerVerifiedAt: null },
  });
  check("but an unanswered piece can still have its owner recorded", stillOpen === 1);

  // ---- Who may record a sale --------------------------------------
  const withSales = async (id: string) =>
    prisma.submission.findUniqueOrThrow({
      where: { id },
      select: {
        ownerId: true,
        artist: { select: { userId: true } },
        sales: { select: { status: true } },
      },
    });

  check(
    "the maker is the seller of a piece they still hold",
    holderOf(await withSales(held.id)) === makerUser.id
  );
  check(
    "the COLLECTOR is the seller once it's theirs, not the maker",
    holderOf(await withSales(sold.id)) === collector.id
  );
  check(
    "a sold pair with no surviving owner has no rightful seller",
    holderOf(await withSales(orphaned.id)) === null,
    "an admin unpicks it; the maker does not get it back"
  );
  check(
    "a piece with no artist and no owner has no seller",
    holderOf({ ownerId: null, artist: null, sales: [] }) === null
  );

  // ---- Identity ---------------------------------------------------
  check("a staff seat can't be adopted at signup", !mayAdoptExistingAccount({ role: "EDITOR" }));
  check("nor an admin one", !mayAdoptExistingAccount({ role: "ADMIN" }));
  check(
    "role casing/whitespace doesn't slip past",
    !mayAdoptExistingAccount({ role: " editor " })
  );
  check(
    "a pre-loaded artist shell still adopts normally",
    mayAdoptExistingAccount({ role: "MEMBER", passwordHash: null }),
    "this is the whole onboarding path — it must not break"
  );
  check("a brand-new email adopts nothing and is fine", mayAdoptExistingAccount(null));
  check("a null role is a member, not a staff seat", mayAdoptExistingAccount({ role: null }));
  check("isStaffRole agrees", isStaffRole("EDITOR") && !isStaffRole("MEMBER") && !isStaffRole(""));

  check(
    "typing an email does not prove it",
    !provesEmail(null, `${TAG}-maker@example.invalid`),
    "no session = no proof, which is the unauthenticated claim form"
  );
  check(
    "signing in as somebody else does not prove it",
    !provesEmail(`${TAG}-stranger@example.invalid`, `${TAG}-maker@example.invalid`)
  );
  check(
    "signing in as that address does",
    provesEmail(`  ${TAG}-Maker@Example.invalid `, `${TAG}-maker@example.invalid`),
    "trimmed and case-folded, because email case is not identity"
  );
  check("two blanks are not a match", !provesEmail("", ""));

  // The real-world shape of the staff row `grantEditor` creates: a role,
  // no password, and a set-password link mailed out of band. That link is
  // the door. Signup is not a second one.
  const staffRow = await prisma.user.create({
    data: { email: `${TAG}-editor@example.invalid`, name: `${TAG} ed`, role: "EDITOR" },
    select: { role: true, passwordHash: true },
  });
  check(
    "the row grantEditor actually creates is refused by name",
    !mayAdoptExistingAccount(staffRow),
    `role=${staffRow.role} passwordHash=${staffRow.passwordHash === null ? "null" : "set"}`
  );

  // ---- The scheduled endpoints ------------------------------------
  // These finalise battles, spend metered API quota, and mail every
  // active member. A missing secret used to mean "come in".
  const cron = (secret: string | undefined, presented: string, production: boolean) =>
    cronKeyAccepted({ secret, bearer: presented, key: "", production });

  check("a blank CRON_SECRET locks production, it does not open it", !cron("", "", true));
  check("undefined does the same", !cron(undefined, "", true));
  check(
    "and locks it even against someone presenting an empty key",
    !cronKeyAccepted({ secret: "", bearer: "", key: "", production: true })
  );
  check("a laptop with no secret still runs the jobs", cron("", "", false));
  check("the real secret is accepted", cron("s3cr3t-value", "s3cr3t-value", true));
  check("a wrong secret is not", !cron("s3cr3t-value", "wrong-value!", true));
  check(
    "a near-miss of the same length is not",
    !cron("s3cr3t-value", "s3cr3t-valuf", true),
    "constant-time compare still has to be a compare"
  );
  check(
    "no key at all is refused when one is configured",
    !cron("s3cr3t-value", "", true)
  );
  check(
    "a base64 secret whose + became a space in a URL still works",
    cronKeyAccepted({ secret: "ab+cd/ef=", bearer: "", key: "ab cd/ef=", production: true }),
    "pasting a key into a scheduler is how this is used in real life"
  );
  check(
    "but a space-for-plus swap can't be used to guess a secret without one",
    !cronKeyAccepted({ secret: "abXcd/ef=", bearer: "", key: "ab cd/ef=", production: true })
  );
}

async function cleanup() {
  await prisma.sale.deleteMany({ where: { buyerEmail: { startsWith: TAG } } });
  await prisma.submission.deleteMany({ where: { title: { startsWith: TAG } } });
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
    console.log("\n=== NOBODY EDITS ANYBODY ELSE'S WORK ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });
