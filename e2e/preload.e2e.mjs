// Onboarding accelerator: admin pre-loads an artist + shoe, gets a
// claim link and outreach DM; the artist claims the account via the
// link and lands as an approved artist.
import { PrismaClient } from "@prisma/client";
import { BASE, SHOTS, PNG_1x1, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const EMAIL = "preload-e2e@test.example";
const results = [];
const check = makeChecker(results);

await prisma.submission.deleteMany({ where: { email: EMAIL } });
await prisma.user.deleteMany({ where: { email: EMAIL } });

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Admin pre-loads the artist
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.fill("#password", ADMIN_PASSWORD);
await page.getByRole("button", { name: "Enter" }).click();
await page.getByText("Pre-load An Artist").waitFor({ timeout: 10000 });

await page.fill("#pl-name", "Preload Test Artist");
await page.fill("#pl-email", EMAIL);
await page.fill("#pl-ig", "@preloadtest");
await page.fill("#pl-title", "Preload Test Custom");
await page.fill("#pl-base", "Dunk High");
await page.setInputFiles("#pl-img", { name: "p.png", mimeType: "image/png", buffer: PNG_1x1 });
await page.getByRole("button", { name: "Pre-load Artist + Piece" }).click();
await page.getByText("Artist is live").waitFor({ timeout: 15000 });
check("preload succeeds with live confirmation", true);

const claimUrl = await page.locator("input[readonly]").first().inputValue();
check("claim link generated", /\/reset-password\/[a-f0-9]{64}/.test(claimUrl));
const dmText = await page.locator("textarea[readonly]").inputValue();
check("outreach DM includes artist page + claim link", dmText.includes("/artists/") && dmText.includes("/reset-password/"));
await page.screenshot({ path: `${SHOTS}/preload-result.png`, fullPage: false });

// Artist + shoe are live and votable-ready
const artist = await prisma.artistProfile.findFirst({
  where: { displayName: "Preload Test Artist" },
  include: { submissions: true },
});
check("artist profile approved", artist?.status === "APPROVED");
check("shoe pre-approved", artist?.submissions?.[0]?.status === "APPROVED");

await page.goto(`${BASE}/artists/${artist.slug}`, { waitUntil: "networkidle" });
check("public artist page live", await page.getByText("Preload Test Custom").isVisible());

// Artist claims the account through the link
const claimPath = new URL(claimUrl).pathname;
await page.goto(`${BASE}${claimPath}`, { waitUntil: "networkidle" });
await page.fill("#password", "claimedpass99");
await page.getByRole("button", { name: "Set New Password" }).click();
await page.getByText("Password updated.").waitFor({ timeout: 10000 });
check("claim link sets a password", true);

await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", "claimedpass99");
await page.getByRole("button", { name: "Sign In", exact: true }).click();
await page.waitForURL("**/profile", { timeout: 15000 });
check("claimed artist can sign in", true);

await page.goto(`${BASE}/submit`, { waitUntil: "networkidle" });
check("claimed account is an approved artist", await page.getByText("approved artist").isVisible());

// ---- Multi-piece preload: same email stacks pieces on one profile ----
// (Run BEFORE claim it would reuse the same token; after claim it must
// skip the claim link entirely and not break the account.)
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.getByText("Pre-load An Artist").waitFor({ timeout: 10000 });
await page.fill("#pl-name", "Preload Test Artist");
await page.fill("#pl-email", EMAIL);
await page.fill("#pl-title", "Preload Second Piece");
await page.fill("#pl-base", "Air Max 95");
await page.fill("#pl-size", "US 11");
await page.setInputFiles("#pl-img", { name: "p2.png", mimeType: "image/png", buffer: PNG_1x1 });
await page.getByRole("button", { name: "Pre-load Artist + Piece" }).click();
await page.getByText("New piece added").waitFor({ timeout: 15000 });
check("second preload adds to the existing page", await page.getByText("already claimed their account").isVisible());

const stacked = await prisma.artistProfile.findMany({
  where: { user: { email: EMAIL } },
  include: { submissions: true },
});
check("one profile, two pieces", stacked.length === 1 && stacked[0].submissions.length === 2);
check("size stored on the stacked piece", stacked[0].submissions.some((s) => s.size === "US 11"));
const claimedUser = await prisma.user.findUnique({ where: { email: EMAIL } });
check("claimed password untouched by re-preload", Boolean(claimedUser?.passwordHash));

// Cleanup
await prisma.submission.deleteMany({ where: { email: EMAIL } });
await prisma.user.deleteMany({ where: { email: EMAIL } });

await browser.close();
await prisma.$disconnect();
console.log(results.join("\n"));
