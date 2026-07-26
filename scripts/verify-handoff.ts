/**
 * The handoff: does a sale actually reach the person who bought it?
 *
 * This exists because it didn't. `recordSale` collected the buyer's
 * email address and then emailed nobody but the admin. The claim link
 * existed, but only rendered on the artist's own public page, so the
 * maker had to go find it and send it by hand. In practice nothing ever
 * got claimed: 22 pieces on the platform, 1 sale recorded, 0 confirmed,
 * 0 owners, 0 collector pages, 0 resales.
 *
 * That single missing email is what kept the market showing nothing but
 * first sales from makers. No claim means no owner; no owner means
 * nothing anybody is able to resell. The resale side never had a demand
 * problem — it had never been given one completed cycle to start from.
 *
 * Run: npm run verify:handoff   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import {
  pendingHandoffs,
  handoffMessage,
  handoffStats,
  allPendingHandoffs,
  buyerClaimEmail,
  claimUrl,
} from "../lib/handoff";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const TAG = "verify-handoff";
const BASE = "https://theheatchart.com";
const DAY = 86400000;
const ago = (d: number) => new Date(Date.now() - d * DAY);
let artistId = "";
const madeSubs: string[] = [];

async function main() {
  // ---- The link and the letter, with no database -------------------
  check("a claim URL points at the sale", claimUrl("abc123", BASE) === `${BASE}/claim/abc123`);
  check("a trailing slash on the base doesn't double up", claimUrl("x", "https://a.com/") === "https://a.com/claim/x");

  {
    const mail = buyerClaimEmail({
      title: "Afro Samurai Resurrection",
      sellerName: "Dekota",
      priceCents: 65000,
      claimUrl: `${BASE}/claim/s1`,
    });
    check("the subject names the seller and the piece",
      mail.subject.includes("Dekota") && mail.subject.includes("Afro Samurai Resurrection"), mail.subject);
    check("the body carries the actual claim link", mail.text.includes(`${BASE}/claim/s1`));
    check("the price is written in dollars, not cents", mail.text.includes("$650") && !mail.text.includes("65000"));
    check("it says what they get", /provenance/i.test(mail.text) && /resell/i.test(mail.text));
    // Somebody who didn't buy anything must be told to ignore it, or a
    // mistyped address turns into a support problem and a spam report.
    check("a wrong recipient is told to ignore it", /didn't buy this/i.test(mail.text));
  }

  {
    const first = buyerClaimEmail({ title: "T", sellerName: "S", priceCents: 100, claimUrl: "u" });
    const again = buyerClaimEmail({ title: "T", sellerName: "S", priceCents: 100, claimUrl: "u", reminder: true });
    check("the reminder reads differently from the first send", first.subject !== again.subject, again.subject);
    check("the reminder still carries the link", again.text.includes("u"));
    check("the reminder doesn't re-announce the price as news", !again.text.includes("recorded selling"));
  }

  {
    const dm = handoffMessage({ title: "Treacherous Waters", artistName: "Dekota", claimUrl: `${BASE}/claim/s2` });
    check("the DM carries the link", dm.includes(`${BASE}/claim/s2`));
    check("the DM is signed by the maker, not the platform", dm.trim().endsWith("— Dekota"));
    check("the DM doesn't read like a platform email", !dm.includes("The Heat Chart"), "it's sent from their account");
  }

  // ---- Against the database ------------------------------------------
  const user = await prisma.user.create({
    data: { email: `${TAG}-seller@example.invalid`, name: TAG },
    select: { id: true },
  });
  const artist = await prisma.artistProfile.create({
    data: { userId: user.id, slug: `${TAG}-a`, displayName: `${TAG} Artist`, status: "APPROVED" },
    select: { id: true },
  });
  artistId = artist.id;

  const piece = async (title: string) => {
    const s = await prisma.submission.create({
      data: {
        title, artistName: `${TAG} Artist`, email: `${TAG}@example.invalid`,
        baseShoe: "AF1", imageUrl: "/x.png", status: "APPROVED", artistId,
      },
      select: { id: true },
    });
    madeSubs.push(s.id);
    return s.id;
  };

  const fresh = await piece(`${TAG} fresh`);
  const old = await piece(`${TAG} old`);
  const done = await piece(`${TAG} done`);

  await prisma.sale.create({
    data: { submissionId: fresh, sellerId: user.id, buyerEmail: `${TAG}-b1@example.invalid`,
            priceCents: 40000, soldAt: ago(1), status: "PENDING" },
  });
  await prisma.sale.create({
    data: { submissionId: old, sellerId: user.id, buyerEmail: `${TAG}-b2@example.invalid`,
            priceCents: 55000, soldAt: ago(11), status: "PENDING" },
  });
  await prisma.sale.create({
    data: { submissionId: done, sellerId: user.id, buyerEmail: `${TAG}-b3@example.invalid`,
            priceCents: 30000, soldAt: ago(20), status: "CONFIRMED" },
  });

  const queue = await pendingHandoffs(artistId, BASE);
  check("only unclaimed sales are in the queue", queue.length === 2, `${queue.length}`);
  check("a confirmed sale has left the queue", !queue.some((q) => q.title.endsWith("done")));
  check("oldest first — the forgotten one is at the top", queue[0].title.endsWith("old"), queue[0].title);
  check("waiting time is counted in days", queue[0].daysWaiting === 11, `${queue[0].daysWaiting}`);
  check("11 days is flagged overdue", queue[0].stale === true);
  check("1 day is not", queue[1].stale === false, `${queue[1].daysWaiting}d`);
  check("each row carries a working claim link", queue.every((q) => q.claimUrl.startsWith(`${BASE}/claim/`)));
  check("each row carries the buyer to chase", queue.every((q) => q.buyerEmail.includes("@")));

  const stats = await handoffStats(artistId);
  check("stats count what's still pending", stats.pending === 2, `${stats.pending}`);
  check("stats count what got claimed", stats.claimed === 1, `${stats.claimed}`);
  // 1 of 3 sales claimed = 33%. Measured against sales, not against
  // pieces — an artist with 20 unsold pieces isn't failing at handoff.
  check("claim rate is claimed over sales", stats.claimRatePct === 33, `${stats.claimRatePct}%`);

  const all = await allPendingHandoffs(BASE);
  const mine = all.filter((a) => a.artistName === `${TAG} Artist`);
  check("the admin view sees the same unclaimed sales", mine.length === 2, `${mine.length}`);
  check("and attributes them to the right artist", mine.every((m) => m.artistSlug === `${TAG}-a`));

  // A second artist's pending sale must not appear in the first one's queue.
  const otherUser = await prisma.user.create({
    data: { email: `${TAG}-other@example.invalid`, name: `${TAG} other` },
    select: { id: true },
  });
  const other = await prisma.artistProfile.create({
    data: { userId: otherUser.id, slug: `${TAG}-b`, displayName: `${TAG} Other`, status: "APPROVED" },
    select: { id: true },
  });
  const otherPiece = await prisma.submission.create({
    data: { title: `${TAG} theirs`, artistName: `${TAG} Other`, email: `${TAG}@example.invalid`,
            baseShoe: "AF1", imageUrl: "/x.png", status: "APPROVED", artistId: other.id },
    select: { id: true },
  });
  madeSubs.push(otherPiece.id);
  await prisma.sale.create({
    data: { submissionId: otherPiece.id, sellerId: otherUser.id, buyerEmail: `${TAG}-b4@example.invalid`,
            priceCents: 20000, soldAt: ago(4), status: "PENDING" },
  });

  const stillTwo = await pendingHandoffs(artistId, BASE);
  check("another artist's unclaimed sale stays out of your queue", stillTwo.length === 2, `${stillTwo.length}`);
  check(
    "and their buyer's address is not exposed to you",
    !stillTwo.some((q) => q.buyerEmail.includes("b4"))
  );
}

async function cleanup() {
  await prisma.sale.deleteMany({ where: { submissionId: { in: madeSubs } } });
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
    console.log("\n=== THE HANDOFF ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });
