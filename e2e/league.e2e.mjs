// Artist league + fan/artist split: fan signup, artist application,
// admin approval, gated submission, closet with heat ranks, ownership
// transfer to a fan's public collector closet.
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

// ---- Ownership: artist sells the piece to a fan ----
await prisma.user.create({ data: { name: "Collector Fan", email: BUYER_EMAIL } });

await page.goto(`${BASE}/artists/league-test-studio`, { waitUntil: "networkidle" });
check("artist sees transfer control on own page", await page.getByText("Sold it? Transfer to buyer").isVisible());
await page.getByText("Sold it? Transfer to buyer").click();
await page.fill("input[name='buyerEmail']", BUYER_EMAIL);
await page.getByRole("button", { name: "Confirm Transfer" }).click();
await page.getByText("Transferred ✓").waitFor({ timeout: 10000 });

const buyer = await prisma.user.findUnique({
  where: { email: BUYER_EMAIL },
  include: { ownedPieces: true },
});
check("ownership recorded on the piece", buyer?.ownedPieces?.[0]?.title === "League Test Custom");
check("collector slug minted", Boolean(buyer?.collectorSlug));

// Public fan closet
await page.goto(`${BASE}/collectors/${buyer.collectorSlug}`, { waitUntil: "networkidle" });
check("fan closet page renders", await page.getByText("Collector Fan's Closet").isVisible());
check("owned piece in fan closet", await page.getByText("League Test Custom").isVisible());
check("fan closet shows heat rank", (await page.locator("text=/#\\d+ Heat/").count()) >= 1);
await page.screenshot({ path: `${SHOTS}/fan-closet.png`, fullPage: true });

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
