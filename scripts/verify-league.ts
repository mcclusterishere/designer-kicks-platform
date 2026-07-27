/**
 * The Draft pays real prizes, so its score has to be unforgeable.
 *
 * This exists because of a live bug. `getDraftSlate` filtered guest votes
 * out of the heat it displayed — and said so in a comment — while
 * `metricForCustoms`, the function that actually decides who gets paid,
 * counted every vote including anonymous ones. The board showed one number
 * and the payout ran on another. A guest vote costs a fresh browser and
 * nothing else, so the weekly credits and giveaway entries were farmable by
 * anyone willing to be patient.
 *
 * A comment can't hold that line, so this does: it stands up a real season,
 * a real entry, and real votes, then asserts through `getMyEntry` and
 * `settleSeason` — the paths that pay — that guest votes move nothing.
 *
 * Run: npm run verify:league   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import { getMyEntry, getDraftSlate, settleSeason } from "../lib/league";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const TAG = "verify-league";
const made = {
  voteIds: [] as string[],
  battleIds: [] as string[],
  submissionIds: [] as string[],
  seasonIds: [] as string[],
  userIds: [] as string[],
};

async function main() {
  // ---- Fixtures -----------------------------------------------------
  const sub = async (title: string) => {
    const s = await prisma.submission.create({
      data: {
        title,
        artistName: TAG,
        email: `${TAG}@example.invalid`,
        baseShoe: "Air Force 1",
        imageUrl: "/placeholder.png",
        status: "APPROVED",
      },
      select: { id: true },
    });
    made.submissionIds.push(s.id);
    return s.id;
  };
  const subA = await sub(`${TAG} A`);
  const subB = await sub(`${TAG} B`);

  const battle = await prisma.battle.create({
    data: { subAId: subA, subBId: subB, endsAt: new Date(Date.now() + 864e5), status: "ACTIVE" },
    select: { id: true },
  });
  made.battleIds.push(battle.id);

  const user = await prisma.user.create({
    data: { email: `${TAG}-entrant@example.invalid`, name: `${TAG} entrant` },
    select: { id: true },
  });
  made.userIds.push(user.id);

  // A season deliberately started long ago so `getCurrentSeason` (which
  // orders by startsAt desc) never mistakes this fixture for the live week.
  const season = await prisma.leagueSeason.create({
    data: {
      label: TAG,
      startsAt: new Date(Date.now() - 3650 * 864e5),
      endsAt: new Date(Date.now() + 864e5),
      status: "OPEN",
    },
    select: { id: true },
  });
  made.seasonIds.push(season.id);

  await prisma.leagueEntry.create({
    data: {
      seasonId: season.id,
      userId: user.id,
      // Snapshot is zero because the piece is brand new: no votes, no
      // battle wins, no sales. Live points are therefore the whole metric.
      picks: { create: [{ assetType: "CUSTOM", refId: subA, label: `${TAG} A`, startMetric: 0 }] },
    },
  });

  const points = async () => (await getMyEntry(user.id, season.id))!.total;
  const slateHeat = async () =>
    (await getDraftSlate()).customs.find((c) => c.refId === subA)?.heat ?? null;

  // ---- The invariant ------------------------------------------------
  check("a fresh pick starts at zero points", (await points()) === 0, `${await points()}`);

  // Guest votes: free to mint, one browser each. Twenty-five of them is a
  // slow evening's work and, before the fix, +50 points — enough to buy
  // first place in a week where the real rosters barely move.
  const castGuest = async (n: number) => {
    for (let i = 0; i < n; i++) {
      const v = await prisma.vote.create({
        data: { battleId: battle.id, submissionId: subA, voterKey: `${TAG}-guest-${i}`, guest: true },
        select: { id: true },
      });
      made.voteIds.push(v.id);
    }
  };
  await castGuest(25);

  const afterGuests = await points();
  check("25 guest votes move the payout metric by zero", afterGuests === 0, `${afterGuests} pts`);
  check(
    "the board agrees with the scorer on guest votes",
    (await slateHeat()) === 0,
    `slate ${await slateHeat()}`
  );

  // Account votes are the real signal: an account is a signup, an email,
  // and a rate limit. Three of them is worth exactly six points.
  const voters: string[] = [];
  for (let i = 0; i < 3; i++) {
    const u = await prisma.user.create({
      data: { email: `${TAG}-voter-${i}@example.invalid`, name: `${TAG} voter ${i}` },
      select: { id: true },
    });
    made.userIds.push(u.id);
    voters.push(u.id);
    const v = await prisma.vote.create({
      data: { battleId: battle.id, submissionId: subA, voterKey: u.id, userId: u.id, guest: false },
      select: { id: true },
    });
    made.voteIds.push(v.id);
  }

  const afterAccounts = await points();
  check("3 account votes are worth 6 points", afterAccounts === 6, `${afterAccounts} pts`);
  check(
    "the board and the scorer report the same number",
    (await slateHeat()) === afterAccounts,
    `slate ${await slateHeat()} vs scorer ${afterAccounts}`
  );

  // A battle win is 50 and must survive the guest filter untouched — the
  // fix narrowed the vote query only.
  await prisma.battle.update({ where: { id: battle.id }, data: { winnerId: subA, status: "COMPLETED" } });
  const afterWin = await points();
  check("a battle win still adds 50", afterWin === 56, `${afterWin} pts`);

  // ---- The payout itself --------------------------------------------
  // settleSeason freezes the score and grants credits off it. If guest
  // votes leaked anywhere, they leak here, in the number that pays.
  const before = await prisma.creditTransaction.count({ where: { userId: user.id } });
  await settleSeason(season.id);
  const settled = await prisma.leagueEntry.findFirstOrThrow({
    where: { seasonId: season.id, userId: user.id },
    select: { finalScore: true, finalRank: true, prize: true },
  });
  check("the frozen score is the account-only score", settled.finalScore === 56, `${settled.finalScore}`);
  check("the entry placed first", settled.finalRank === 1, `rank ${settled.finalRank}`);
  check("a prize was recorded", !!settled.prize, settled.prize ?? "none");

  const after = await prisma.creditTransaction.count({ where: { userId: user.id } });
  check("the payout hit the ledger exactly once", after - before === 1, `${after - before} entries`);

  // Settling is claimed atomically, so a second pass must be a no-op
  // rather than a second week's credits.
  await settleSeason(season.id);
  const afterReplay = await prisma.creditTransaction.count({ where: { userId: user.id } });
  check("re-settling pays nothing", afterReplay === after, `${afterReplay - after} extra`);
}

async function cleanup() {
  await prisma.vote.deleteMany({ where: { id: { in: made.voteIds } } });
  await prisma.battle.deleteMany({ where: { id: { in: made.battleIds } } });
  await prisma.leagueSeason.deleteMany({ where: { id: { in: made.seasonIds } } }); // cascades entries + picks
  await prisma.submission.deleteMany({ where: { id: { in: made.submissionIds } } });
  await prisma.user.deleteMany({ where: { id: { in: made.userIds } } }); // cascades ledger rows
  // Belt and braces: anything tagged that an earlier crashed run left behind.
  await prisma.submission.deleteMany({ where: { artistName: TAG } });
  await prisma.leagueSeason.deleteMany({ where: { label: TAG } });
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}-` } } });
}

main()
  .catch((e) => {
    fail++;
    log.push(`FAIL threw — ${e instanceof Error ? e.message : String(e)}`);
  })
  .then(cleanup)
  .finally(async () => {
    await prisma.$disconnect();
    console.log("\n=== THE DRAFT: PAYOUT INTEGRITY ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });
