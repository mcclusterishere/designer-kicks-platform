// Artist league + fan/artist split: fan signup, artist application,
// admin approval, gated submission, closet with heat ranks, and the
// retroactive sale flow — record → pending sticker → buyer claims on
// their own account → verified badge, ownership transfer, market board.
import { PrismaClient } from "@prisma/client";
import { BASE, SHOTS, PNG_1x1, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const EMAIL = "league-e2e@test.example";
const BUYER_EMAIL = "collector-e2e@test.example";
const results = [];
const check = makeChecker(results);

await prisma.user.deleteMany({ where: { email: { in: [EMAIL, BUYER_EMAIL] } } });
await prisma.submission.deleteMany({ where: { email: EMAIL } });

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Logged out: submit is gated
await page.goto(`${BASE}/submit`, { waitUntil: "networkidle" });
check("submit gated when logged out", await page.getByText("Sign in to submit").isVisible());

// Register → instant FAN account
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await page.fill("#name", "League Tester");
await page.fill("#email", EMAIL);
await page.fill("#password", "supersecret1");
await page.getByRole("button", { name: "Create Account" }).click();
await page.waitForURL("**/profile", { timeout: 15000 });
check("fan account badge on profile", await page.getByText("Fan account").isVisible());

// Fan cannot submit — sees the application instead
await page.goto(`${BASE}/submit`, { waitUntil: "networkidle" });
check("fan sees artist application, not submit form", await page.getByText("You have a fan account").isVisible());

// Apply for an artist account
await page.fill("#a-name", "League Test Studio");
await page.fill("#a-ig", "@leaguetest");
await page.fill("#a-city", "Atlanta, GA");
await page.fill("#a-bio", "Five years of customs.");
await page.getByRole("button", { name: "Apply For An Artist Account" }).click();
await page.getByText("Application In").waitFor({ timeout: 10000 });
const applicant = await prisma.artistProfile.findFirst({ where: { displayName: "League Test Studio" } });
check("application stored as PENDING", applicant?.status === "PENDING");

await page.goto(`${BASE}/submit`, { waitUntil: "networkidle" });
check("pending state shown on submit page", await page.getByText("Application Under Review").isVisible());
check("pending artist hidden from public league", !(await (await fetch(`${BASE}/artists/league-test-studio`)).ok));

// Admin approves the application (admin cookie coexists with the session)
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.fill("#password", ADMIN_PASSWORD);
await page.getByRole("button", { name: "Enter" }).click();
await page.getByText("Artist Applications").waitFor({ timeout: 10000 });
check("application visible to admin", await page.getByText("League Test Studio").first().isVisible());
await page.getByRole("button", { name: "Approve", exact: true }).first().click();
await page.waitForTimeout(1500);
const approved = await prisma.artistProfile.findFirst({ where: { displayName: "League Test Studio" } });
check("admin approval flips status", approved?.status === "APPROVED");

// Approved artist can now submit
await page.goto(`${BASE}/submit`, { waitUntil: "networkidle" });
check("approved artist badge on submit page", await page.getByText("approved artist").isVisible());
await page.fill("#title", "League Test Custom");
await page.fill("#baseShoe", "Air Max 1");
await page.setInputFiles("#image", { name: "c.png", mimeType: "image/png", buffer: PNG_1x1 });
await page.getByRole("button", { name: "Submit To The Arena" }).click();
await page.getByText("You're in.").waitFor({ timeout: 15000 });
const sub = await prisma.submission.findFirst({ where: { email: EMAIL } });
check("submission linked to approved artist", sub?.artistId === approved?.id);

// Approve the shoe so it shows in the closet
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.locator("div", { hasText: "League Test Custom" }).locator("button", { hasText: "Approve" }).first().click();
await page.waitForTimeout(1500);

// League + artist closet (demo artists)
await page.goto(`${BASE}/artists`, { waitUntil: "networkidle" });
check("league table renders", await page.getByText("SoleFire Studio").first().isVisible());

await page.goto(`${BASE}/artists/solefire-studio`, { waitUntil: "networkidle" });
check("artist page shows W-L record", await page.locator("text=/\\dW–\\dL/").first().isVisible());
check("closet renders the collection", await page.getByText("The Closet").isVisible());
check("closet shows live heat ranks", (await page.locator("text=/#\\d+ Heat/").count()) >= 2);
check("trophy shelf section present", await page.getByText("Trophy Shelf").isVisible());

// Follow flow
await page.getByRole("button", { name: "+ Follow" }).click();
await page.getByRole("button", { name: /Following/ }).waitFor({ timeout: 10000 });
const me = await prisma.user.findUnique({ where: { email: EMAIL } });
check("follow persists to database", Boolean(await prisma.artistFollow.findFirst({ where: { userId: me.id } })));

// ---- Retroactive sale: seller records it, buyer claims on their own account ----
await page.goto(`${BASE}/artists/league-test-studio`, { waitUntil: "networkidle" });
check("artist sees record-sale control on own page", await page.getByText("Sold it? Record the sale").isVisible());
await page.getByText("Sold it? Record the sale").click();
await page.fill("input[name='buyerEmail']", BUYER_EMAIL);
await page.fill("input[name='price']", "450");
await page.setInputFiles("input[name='evidence']", { name: "receipt.png", mimeType: "image/png", buffer: PNG_1x1 });
await page.getByRole("button", { name: "Record Sale (buyer claims it)" }).click();
// recordSale revalidates this page, so the fresh render's pending sticker
// (not the client form's success state) is the reliable signal.
await page.getByText("Sale Pending").waitFor({ timeout: 15000 });

const pendingSale = await prisma.sale.findFirst({ where: { submission: { email: EMAIL } } });
check(
  "sale stored PENDING with price + evidence",
  pendingSale?.status === "PENDING" && pendingSale?.priceCents === 45000 && Boolean(pendingSale?.evidenceUrl)
);

await page.goto(`${BASE}/artists/league-test-studio`, { waitUntil: "networkidle" });
check("pending sticker on the artist closet", await page.getByText("Sale Pending").isVisible());
check("record-sale hidden while a claim is pending", !(await page.getByText("Sold it? Record the sale").isVisible()));

// Unclaimed sales must not price the market board
const marketBefore = await (await fetch(`${BASE}/market`)).text();
check("pending sale not on the market board", !marketBefore.includes("League Test Custom"));

// Buyer claims from their own account (fresh browser context = another device)
const buyerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const buyerPage = await buyerCtx.newPage();
await buyerPage.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await buyerPage.fill("#name", "Collector Fan");
await buyerPage.fill("#email", BUYER_EMAIL);
await buyerPage.fill("#password", "supersecret2");
await buyerPage.getByRole("button", { name: "Create Account" }).click();
await buyerPage.waitForURL("**/profile", { timeout: 15000 });

check("pending claim surfaces on buyer profile", await buyerPage.getByRole("heading", { name: "Pending Claims" }).isVisible());
check("claim card names the piece", await buyerPage.getByText("League Test Custom").isVisible());
check("evidence noted on the claim card", await buyerPage.getByText("evidence attached ✓").isVisible());
await buyerPage.getByRole("button", { name: "Claim This Piece" }).click();
// claimSale revalidates /profile — the claim section unmounts on success.
await buyerPage.getByRole("heading", { name: "Pending Claims" }).waitFor({ state: "hidden", timeout: 15000 });
check("claimed piece lands in My Closet", await buyerPage.getByRole("heading", { name: "My Closet" }).isVisible());

const buyer = await prisma.user.findUnique({
  where: { email: BUYER_EMAIL },
  include: { ownedPieces: true },
});
const confirmedSale = await prisma.sale.findUnique({ where: { id: pendingSale.id } });
check(
  "claim confirms the sale + evidence auto-verifies",
  confirmedSale?.status === "CONFIRMED" &&
    confirmedSale?.verified === true &&
    confirmedSale?.verifiedBy === "evidence" &&
    confirmedSale?.buyerId === buyer?.id
);
check("ownership recorded on the piece", buyer?.ownedPieces?.[0]?.title === "League Test Custom");
check("collector slug minted", Boolean(buyer?.collectorSlug));

// Public fan closet
await buyerPage.goto(`${BASE}/collectors/${buyer.collectorSlug}`, { waitUntil: "networkidle" });
check("fan closet page renders", await buyerPage.getByText("Collector Fan's Closet").isVisible());
check("owned piece in fan closet", await buyerPage.getByText("League Test Custom").isVisible());
check("fan closet shows heat rank", (await buyerPage.locator("text=/#\\d+ Heat/").count()) >= 1);
check("verified sale chip in fan closet", await buyerPage.getByText("✓ verified sale").isVisible());
await buyerPage.screenshot({ path: `${SHOTS}/fan-closet.png`, fullPage: true });

// New owner lists an ask; the market board picks up sale + ask
await buyerPage.fill("input[name='price']", "600");
await buyerPage.getByRole("button", { name: "Set Ask" }).click();
await buyerPage.waitForTimeout(1500);
const listed = await prisma.submission.findFirst({ where: { email: EMAIL } });
check("owner's ask persists", listed?.askingPriceCents === 60000);

await buyerPage.goto(`${BASE}/market`, { waitUntil: "networkidle" });
check("market lists the piece after the claim", await buyerPage.getByText("League Test Custom").isVisible());
check("market shows the verified last sale", await buyerPage.getByText("$450").first().isVisible());
check("market shows the open ask", await buyerPage.getByText("$600").first().isVisible());
await buyerPage.screenshot({ path: `${SHOTS}/market.png`, fullPage: true });
await buyerCtx.close();

// Admin sales ledger shows the evidence-verified sale
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
check("sale in admin ledger, evidence-verified", await page.getByText("✓ verified (evidence)").first().isVisible());

// Provenance shown on the artist page
await page.goto(`${BASE}/artists/league-test-studio`, { waitUntil: "networkidle" });
check("artist closet shows provenance", await page.getByText(/In Collector Fan/).isVisible());

// Battle page cross-links still work
await page.goto(`${BASE}/battles`, { waitUntil: "networkidle" });
await page.locator("a[href^='/battles/']").first().click();
await page.waitForURL("**/battles/**");
check("battle page links artist profiles", (await page.locator("a[href^='/artists/']").count()) >= 1);

// Cleanup
await prisma.submission.deleteMany({ where: { email: EMAIL } });
await prisma.user.deleteMany({ where: { email: { in: [EMAIL, BUYER_EMAIL] } } });

await browser.close();
await prisma.$disconnect();
console.log(results.join("\n"));
