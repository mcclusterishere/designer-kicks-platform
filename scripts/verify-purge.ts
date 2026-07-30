/**
 * Deleting the accounts that were never people — without deleting the gallery.
 *
 * The instruction that produces this file is always some version of "get
 * rid of everyone who never signed up". The trap inside it is that on this
 * site an artist page normally exists BEFORE its artist does: we research
 * a customizer, build their page from their real work, and then go find
 * them. Every one of those pages is "unclaimed". Acting on unclaimed alone
 * empties the shelves.
 *
 * So half these checks are about what the purge REFUSES, and the other
 * half are about the schema traps that make a naive delete leave the
 * database worse than it found it:
 *
 *   - Submission.artist is SetNull, so deleting a user does not delete
 *     their pieces — it strands them, live in the market, pointing at an
 *     artist page that now 404s.
 *   - Battle.subA/subB have no delete rule at all, so any piece that ever
 *     appeared in a battle refuses to delete and takes the batch with it.
 *   - A piece the account merely BOUGHT belongs to somebody else.
 *
 * Run: npm run verify:purge   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import { classifyAccounts, purgeAccounts } from "../lib/purge";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

/** Every row this script creates carries this somewhere findable. */
const TAG = "vpurge";

async function account(
  label: string,
  opts: {
    email?: string;
    role?: string;
    passwordHash?: string;
    oauth?: boolean;
    slug?: string;
    foundingNumber?: number;
  } = {}
) {
  const user = await prisma.user.create({
    data: {
      email: opts.email ?? `${TAG}-${label}@kickslab.invalid`,
      name: `${TAG} ${label}`,
      ...(opts.role ? { role: opts.role } : {}),
      ...(opts.passwordHash ? { passwordHash: opts.passwordHash } : {}),
    },
    select: { id: true, email: true },
  });
  if (opts.oauth) {
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: "google",
        providerAccountId: `${TAG}-${label}`,
      },
    });
  }
  let profileId: string | null = null;
  if (opts.slug !== undefined) {
    const p = await prisma.artistProfile.create({
      data: {
        userId: user.id,
        displayName: `${TAG} ${label}`,
        slug: opts.slug,
        status: "APPROVED",
        ...(opts.foundingNumber ? { foundingNumber: opts.foundingNumber } : {}),
      },
      select: { id: true },
    });
    profileId = p.id;
  }
  return { ...user, profileId };
}

async function piece(artistId: string | null, title: string, extra: Record<string, unknown> = {}) {
  return prisma.submission.create({
    data: {
      title: `${TAG} ${title}`,
      artistName: TAG,
      email: `${TAG}@kickslab.invalid`,
      baseShoe: "Air Force 1",
      imageUrl: `/seed/${TAG}-${title.replace(/\W/g, "")}.jpg`,
      status: "APPROVED",
      ...(artistId ? { artistId } : {}),
      ...extra,
    },
    select: { id: true },
  });
}

function rowFor(rows: Awaited<ReturnType<typeof classifyAccounts>>, id: string) {
  return rows.find((r) => r.userId === id);
}

async function main() {
  // ---- Who is what ------------------------------------------------------
  const fixture = await account("fixture", {
    email: `demo+${TAG}-fixture@theheatchart.example`,
    slug: `${TAG}-fixture`,
  });
  const testDomain = await account("testdomain", { email: `${TAG}-td@test.example` });
  const rosterArtist = await account("roster", { slug: `${TAG}-roster` });
  const withPassword = await account("password", { passwordHash: "$2b$10$notarealhash" });
  const withGoogle = await account("google", { oauth: true });
  const editor = await account("editor", { role: "EDITOR" });
  const seatHolder = await account("seat", {
    email: `demo+${TAG}-seat@theheatchart.example`,
    slug: `${TAG}-seat`,
    foundingNumber: 9931,
  });

  let rows = await classifyAccounts();

  check("a demo+ address is a fixture", rowFor(rows, fixture.id)?.kind === "demo");
  check("so is anything @test.example", rowFor(rows, testDomain.id)?.kind === "demo");
  check(
    "a pre-loaded artist who never logged in is ROSTER, not a fixture",
    rowFor(rows, rosterArtist.id)?.kind === "roster",
    "this is the check that stops the gallery being deleted as test data"
  );
  check("setting a password makes an account claimed", rowFor(rows, withPassword.id)?.kind === "claimed");
  check(
    "so does signing in with Google — no password row exists in that case",
    rowFor(rows, withGoogle.id)?.kind === "claimed"
  );
  check("staff are their own pile", rowFor(rows, editor.id)?.kind === "staff");
  check(
    "a founding seat is reported alongside the account",
    rowFor(rows, seatHolder.id)?.foundingNumber === 9931
  );

  // ---- What it refuses --------------------------------------------------
  const claimedRefusal = await purgeAccounts([withPassword.id], { allowRoster: true });
  check(
    "a claimed account is refused even with the override on",
    !claimedRefusal.ok,
    claimedRefusal.ok ? "IT DELETED A REAL PERSON" : claimedRefusal.error
  );

  const oauthRefusal = await purgeAccounts([withGoogle.id], { allowRoster: true });
  check("a Google account is refused too", !oauthRefusal.ok);

  const staffRefusal = await purgeAccounts([editor.id], { allowRoster: true });
  check("staff are refused", !staffRefusal.ok);

  const rosterRefusal = await purgeAccounts([rosterArtist.id]);
  check(
    "a real unclaimed artist is refused by default",
    !rosterRefusal.ok,
    rosterRefusal.ok ? "IT DELETED THE GALLERY" : rosterRefusal.error
  );

  const seatRefusal = await purgeAccounts([seatHolder.id], { allowRoster: true });
  check(
    "a founding seat holder is refused — a hundred with a gap in it isn't a hundred",
    !seatRefusal.ok
  );

  const ghost = await purgeAccounts(["no-such-user-id"]);
  check("an id that no longer exists refuses the whole batch", !ghost.ok);

  const nothing = await purgeAccounts([]);
  check("an empty selection does nothing", !nothing.ok);

  // A batch is all-or-nothing: one claimed account in it stops everything.
  const mixed = await purgeAccounts([fixture.id, withPassword.id]);
  check("one protected account blocks the whole batch", !mixed.ok);
  const survived = await prisma.user.findUnique({ where: { id: fixture.id }, select: { id: true } });
  check("and nothing in that batch was deleted first", survived !== null);

  // ---- What it actually deletes ----------------------------------------
  // The fixture is wired into everything a piece can be wired into, so the
  // delete has to walk all of it.
  const fixturePiece = await piece(fixture.profileId, "fixture piece");
  const otherFixture = await account("fixture2", {
    email: `demo+${TAG}-fixture2@theheatchart.example`,
    slug: `${TAG}-fixture2`,
  });
  const opponent = await piece(otherFixture.profileId, "opponent");

  const battle = await prisma.battle.create({
    data: {
      subAId: fixturePiece.id,
      subBId: opponent.id,
      winnerId: fixturePiece.id,
      endsAt: new Date(0),
    },
    select: { id: true },
  });
  await prisma.vote.create({
    data: { battleId: battle.id, submissionId: fixturePiece.id, voterKey: `${TAG}-voter` },
  });

  const tournament = await prisma.tournament.create({
    data: {
      name: `${TAG} bracket`,
      slug: `${TAG}-bracket`,
      size: 4,
      championId: fixturePiece.id,
    },
    select: { id: true },
  });
  const match = await prisma.tournamentMatch.create({
    data: {
      tournamentId: tournament.id,
      round: 1,
      position: 0,
      subAId: fixturePiece.id,
      subBId: opponent.id,
    },
    select: { id: true },
  });

  // A surviving artist page leading with the piece that's about to go.
  await prisma.artistProfile.update({
    where: { id: rosterArtist.profileId! },
    data: { featuredSubmissionId: fixturePiece.id },
  });

  // The piece the fixture BOUGHT from a real artist. Not theirs to take.
  const rosterPiece = await piece(rosterArtist.profileId, "roster piece", {
    ownerId: fixture.id,
    ownershipStatus: "SOLD",
  });

  const res = await purgeAccounts([fixture.id]);
  check("the fixture is deleted", res.ok, res.ok ? "" : res.error);
  check("its piece count is reported", res.ok && res.piecesDeleted === 1, res.ok ? String(res.piecesDeleted) : "");

  check(
    "the user row is gone",
    (await prisma.user.findUnique({ where: { id: fixture.id }, select: { id: true } })) === null
  );
  check(
    "the artist page is gone",
    (await prisma.artistProfile.findUnique({ where: { id: fixture.profileId! }, select: { id: true } })) === null
  );
  check(
    "the piece is GONE, not orphaned into the live market",
    (await prisma.submission.findUnique({ where: { id: fixturePiece.id }, select: { id: true } })) === null,
    "Submission.artist is SetNull — a cascade would have left this listed with no artist"
  );
  check(
    "the battle it was in went with it",
    (await prisma.battle.findUnique({ where: { id: battle.id }, select: { id: true } })) === null,
    "Battle.subA has no delete rule; leaving it would have failed the whole purge"
  );
  check(
    "and that battle's votes with it",
    (await prisma.vote.count({ where: { battleId: battle.id } })) === 0
  );

  const matchAfter = await prisma.tournamentMatch.findUnique({
    where: { id: match.id },
    select: { subAId: true, subBId: true },
  });
  check("the bracket slot was detached", matchAfter?.subAId === null, "a bracket that happened is history");
  check("the opponent's slot was left alone", matchAfter?.subBId === opponent.id);
  check(
    "the tournament survives with no champion",
    (await prisma.tournament.findUnique({ where: { id: tournament.id }, select: { championId: true } }))
      ?.championId === null
  );

  const rosterAfter = await prisma.artistProfile.findUnique({
    where: { id: rosterArtist.profileId! },
    select: { featuredSubmissionId: true },
  });
  check("the surviving artist page no longer features a deleted piece", rosterAfter?.featuredSubmissionId === null);

  const bought = await prisma.submission.findUnique({
    where: { id: rosterPiece.id },
    select: { id: true, ownerId: true, artistId: true },
  });
  check(
    "a piece the fixture only BOUGHT still exists",
    bought !== null,
    "it was made by a real artist — the buyer leaving doesn't destroy the shoe"
  );
  check("and went back to its artist", bought?.ownerId === null && bought?.artistId === rosterArtist.profileId);
  check(
    "the opponent's piece is untouched",
    (await prisma.submission.findUnique({ where: { id: opponent.id }, select: { id: true } })) !== null
  );

  // ---- The override does work when it's meant to -----------------------
  const doomed = await account("doomed", { slug: `${TAG}-doomed` });
  await piece(doomed.profileId, "doomed piece");
  const forced = await purgeAccounts([doomed.id], { allowRoster: true });
  check("a real unclaimed artist CAN be deleted when explicitly allowed", forced.ok, forced.ok ? "" : forced.error);
  check(
    "and their work goes with them",
    (await prisma.submission.count({ where: { artistId: doomed.profileId } })) === 0
  );

  rows = await classifyAccounts();
  check(
    "the people who signed in are all still here",
    [withPassword.id, withGoogle.id, editor.id].every((id) => rowFor(rows, id) !== undefined)
  );
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { contains: TAG } }, { name: { startsWith: TAG } }] },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const profiles = await prisma.artistProfile.findMany({
    where: { OR: [{ userId: { in: userIds } }, { slug: { startsWith: TAG } }] },
    select: { id: true },
  });
  const profileIds = profiles.map((p) => p.id);
  const pieces = await prisma.submission.findMany({
    where: { OR: [{ title: { startsWith: TAG } }, { artistId: { in: profileIds } }] },
    select: { id: true },
  });
  const pieceIds = pieces.map((p) => p.id);

  await prisma.tournamentMatch.deleteMany({ where: { tournament: { slug: { startsWith: TAG } } } });
  await prisma.tournament.deleteMany({ where: { slug: { startsWith: TAG } } });
  await prisma.vote.deleteMany({ where: { submissionId: { in: pieceIds } } });
  await prisma.battle.deleteMany({
    where: { OR: [{ subAId: { in: pieceIds } }, { subBId: { in: pieceIds } }] },
  });
  await prisma.artistProfile.updateMany({
    where: { featuredSubmissionId: { in: pieceIds } },
    data: { featuredSubmissionId: null },
  });
  await prisma.sale.deleteMany({ where: { submissionId: { in: pieceIds } } });
  await prisma.submission.deleteMany({ where: { id: { in: pieceIds } } });
  await prisma.artistProfile.deleteMany({ where: { id: { in: profileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

main()
  .catch((e) => {
    fail++;
    log.push(`FAIL threw — ${e instanceof Error ? e.message : String(e)}`);
  })
  .then(cleanup)
  .catch((e) => {
    log.push(`(cleanup) ${e instanceof Error ? e.message : String(e)}`);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("\n=== DELETING THE FAKE ACCOUNTS, KEEPING THE REAL ONES ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });
