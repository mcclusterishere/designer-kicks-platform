// Provenance: sell -> link -> buyer claims -> ownership transfers.
//
// This is the mechanic the whole customs thesis rests on. A one-of-one is
// only "art with a record" if the record actually moves when the piece
// does — so this drives the real flow in a browser and then checks the
// database, rather than trusting the success message on screen.
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { BASE, makeChecker, launchBrowser } from "./helpers.mjs";
const prisma = new PrismaClient();
const PASS = "ClaimCheck!2026";
const mk = (n) => `claim-${n}-${process.pid}@example.invalid`;

// A seller who owns a piece, and a buyer who doesn't have it yet.
const artistUser = await prisma.user.create({
  data: { email: mk("artist"), name: "Claim Artist", passwordHash: await hash(PASS,10), pmaAcceptedAt: new Date() },
});
const artist = await prisma.artistProfile.create({
  data: { userId: artistUser.id, slug: `claim-artist-${process.pid}`, displayName: "Claim Artist", status: "APPROVED" },
});
const piece = await prisma.submission.create({
  data: { title: "Claim Test One-of-One", artistName: "Claim Artist", email: artistUser.email,
          baseShoe: "Air Force 1", imageUrl: "/placeholder.png", status: "APPROVED", artistId: artist.id },
});
const buyerUser = await prisma.user.create({
  data: { email: mk("buyer"), name: "Claim Buyer", passwordHash: await hash(PASS,10), pmaAcceptedAt: new Date() },
});
// The seller records the sale against the buyer's email — this is what
// produces the link they text over.
const sale = await prisma.sale.create({
  data: { submissionId: piece.id, sellerId: artistUser.id, buyerEmail: buyerUser.email.toLowerCase(), priceCents: 45000 },
});

const results = [];
const check = makeChecker(results);

const b = await launchBrowser();
const p = await b.newPage();
try {
  // 1. The claim link is readable by anyone, no account needed.
  const r = await p.goto(`${BASE}/claim/${sale.id}`, { waitUntil: "networkidle" });
  const t = await p.textContent("body");
  check("claim link opens without an account", r.status() === 200);
  check("it names the piece", /Claim Test One-of-One/.test(t));
  check("it masks the buyer email", !t.includes(buyerUser.email) && /•/.test(t), "no raw email leaked");

  // 2. Buyer signs in and claims from their profile.
  await p.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', buyerUser.email);
  await p.fill('input[name="password"]', PASS);
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/profile/, { timeout: 20000 }).catch(()=>{});
  const prof = await p.textContent("body");
  check("the pending piece appears on the buyer's profile", /Claim Test One-of-One/.test(prof));

  const btn = p.getByRole("button", { name: /Claim This Piece/i }).first();
  check("a claim button is offered", await btn.count() > 0);
  if (await btn.count()) {
    await btn.click();
    await p.getByText(/it's in your closet|Claimed/i).first().waitFor({ timeout: 15000 }).catch(()=>{});
  }

  // 3. Ownership actually moved in the database.
  const after = await prisma.submission.findUnique({ where: { id: piece.id }, select: { ownerId: true } });
  const saleAfter = await prisma.sale.findUnique({ where: { id: sale.id }, select: { status: true, buyerId: true } });
  check("ownership transferred to the buyer", after.ownerId === buyerUser.id, `owner=${after.ownerId===buyerUser.id?"buyer":after.ownerId}`);
  check("the sale is now CONFIRMED", saleAfter.status === "CONFIRMED", saleAfter.status);
  check("the buyer is recorded on the sale", saleAfter.buyerId === buyerUser.id);
} finally {
  await b.close();
  await prisma.sale.deleteMany({ where: { submissionId: piece.id } });
  await prisma.submission.delete({ where: { id: piece.id } }).catch(()=>{});
  await prisma.artistProfile.delete({ where: { id: artist.id } }).catch(()=>{});
  await prisma.user.deleteMany({ where: { id: { in: [artistUser.id, buyerUser.id] } } });
  await prisma.$disconnect();
}
console.log("\n=== PROVENANCE / CLAIM SUITE ===");
for (const r of results) console.log(r);
