// Artist league: gated submit, auto-created artist profile, rankings,
// artist page record + follow, battle page cross-links.
import { PrismaClient } from "@prisma/client";
import { BASE, SHOTS, PNG_1x1, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const EMAIL = "league-e2e@test.example";
const results = [];
const check = makeChecker(results);

await prisma.user.deleteMany({ where: { email: EMAIL } });
await prisma.submission.deleteMany({ where: { email: EMAIL } });

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Logged out: submit is gated
await page.goto(`${BASE}/submit`, { waitUntil: "networkidle" });
check("submit gated when logged out", await page.getByText("Sign in to submit").isVisible());

// Register
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await page.fill("#name", "League Tester");
await page.fill("#email", EMAIL);
await page.fill("#password", "supersecret1");
await page.getByRole("button", { name: "Create Account" }).click();
await page.waitForURL("**/profile", { timeout: 15000 });

// Submit a shoe → artist profile auto-created
await page.goto(`${BASE}/submit`, { waitUntil: "networkidle" });
await page.fill("#title", "League Test Custom");
await page.fill("#artistName", "League Test Studio");
await page.fill("#socialHandle", "@leaguetest");
await page.fill("#baseShoe", "Air Max 1");
await page.setInputFiles("#image", { name: "c.png", mimeType: "image/png", buffer: PNG_1x1 });
await page.getByRole("button", { name: "Submit To The Arena" }).click();
await page.getByText("You're in.").waitFor({ timeout: 15000 });

const user = await prisma.user.findUnique({
  where: { email: EMAIL },
  include: { artistProfile: true },
});
check("submission auto-creates artist profile", user?.artistProfile?.displayName === "League Test Studio");
const sub = await prisma.submission.findFirst({ where: { email: EMAIL } });
check("submission linked to artist", sub?.artistId === user?.artistProfile?.id);

// Second submit: identity locked to existing profile
await page.goto(`${BASE}/submit`, { waitUntil: "networkidle" });
check("second submit posts under existing artist identity", await page.getByText("Posting as").isVisible());

// League rankings page (demo artists have records)
await page.goto(`${BASE}/artists`, { waitUntil: "networkidle" });
check("league table renders", await page.getByText("Artist").first().isVisible());
check("demo artist ranked", await page.getByText("SoleFire Studio").first().isVisible());
await page.screenshot({ path: `${SHOTS}/league.png`, fullPage: true });

// Artist page: record, portfolio, follow
await page.goto(`${BASE}/artists/solefire-studio`, { waitUntil: "networkidle" });
check("artist page shows W-L record", await page.locator("text=/\\dW–\\dL/").first().isVisible());
check("artist portfolio renders", (await page.locator("img[alt*='custom']").count()) >= 2);

await page.getByRole("button", { name: "+ Follow" }).click();
await page.getByRole("button", { name: /Following/ }).waitFor({ timeout: 10000 });
const follow = await prisma.artistFollow.findFirst({ where: { userId: user.id } });
check("follow persists to database", Boolean(follow));

// Battle page links to artist profiles
await page.goto(`${BASE}/battles`, { waitUntil: "networkidle" });
await page.locator("a[href^='/battles/']").first().click();
await page.waitForURL("**/battles/**");
check("battle page links artist profiles", (await page.locator("a[href^='/artists/']").count()) >= 1);

// Cleanup
await prisma.submission.deleteMany({ where: { email: EMAIL } });
await prisma.user.deleteMany({ where: { email: EMAIL } });

await browser.close();
await prisma.$disconnect();
console.log(results.join("\n"));
