// Fit Battles + Outreach: a fan builds an outfit from owned pieces,
// the admin curates house fits and matches a battle, the public page
// renders and takes votes, and the admin outreach module invites a
// cold lead with a claim link.
import { PrismaClient } from "@prisma/client";
import { BASE, SHOTS, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const FAN_EMAIL = "outfit-fan@test.example";
const LEAD_EMAIL = "outreach-lead@test.example";
const LEAD_SLUG = "outreach-test-lead";
const results = [];
const check = makeChecker(results);

// ---------- Cleanup from prior runs ----------
await prisma.outfitBattle.deleteMany({
  where: { OR: [{ outfitA: { name: { startsWith: "E2E " } } }, { outfitB: { name: { startsWith: "E2E " } } }] },
});
await prisma.outfit.deleteMany({ where: { name: { startsWith: "E2E " } } });
await prisma.artistProfile.deleteMany({ where: { slug: LEAD_SLUG } });
await prisma.user.deleteMany({ where: { email: { in: [FAN_EMAIL, LEAD_EMAIL, "outreach-lead@theheatchart.com"] } } });

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// ---------- Fan registers and gets a closet ----------
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await page.fill("#name", "Outfit Fan");
await page.fill("#email", FAN_EMAIL);
await page.fill("#password", "fitcheck99");
await page.getByRole("button", { name: "Create Account" }).click();
await page.waitForURL("**/profile", { timeout: 15000 });
const fan = await prisma.user.findUnique({ where: { email: FAN_EMAIL } });
check("fan account created", Boolean(fan));

// Hand the fan two approved pieces (owner reverts to null on cleanup
// since Submission.owner is SetNull on user delete).
const closetPieces = await prisma.submission.findMany({
  where: { status: "APPROVED", ownerId: null },
  take: 2,
});
check("two approved pieces available to own", closetPieces.length === 2);
await prisma.submission.updateMany({
  where: { id: { in: closetPieces.map((s) => s.id) } },
  data: { ownerId: fan.id },
});

// ---------- Fan builds a fit from their closet ----------
await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: /Build a/ }).waitFor({ timeout: 10000 });
await page.fill("#fit-name", "E2E Fan Fit");
for (const s of closetPieces) {
  await page.locator(`label:has(input[name="pieces"][value="${s.id}"])`).click();
}
await page.getByRole("button", { name: "Enter The Fit Battles" }).click();
await page.getByText("Fit submitted 🔥").waitFor({ timeout: 15000 });
const fanFit = await prisma.outfit.findFirst({
  where: { name: "E2E Fan Fit" },
  include: { _count: { select: { items: true } } },
});
check("fan fit saved as FAN with 2 pieces", fanFit?.kind === "FAN" && fanFit?._count.items === 2 && fanFit?.ownerId === fan.id);
await page.screenshot({ path: `${SHOTS}/outfits-fan-builder.png` });

// ---------- Admin curates two house fits and matches a battle ----------
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await adminCtx.newPage();
await admin.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await admin.fill("#password", ADMIN_PASSWORD);
await admin.getByRole("button", { name: "Enter" }).click();
await admin.getByRole("heading", { name: "Outfit Studio" }).waitFor({ timeout: 10000 });
check("admin sees Outfit Studio", true);
check("admin sees category leaders", (await admin.getByText(/Top sneakers/).count()) === 1);

const housePieces = await prisma.submission.findMany({ where: { status: "APPROVED" }, take: 4 });
async function buildHouseFit(name, pieces) {
  await admin.fill("#ho-name", name);
  for (const s of pieces) {
    await admin.locator(`input[name="pieces"][value="${s.id}"]`).setChecked(true);
  }
  await admin.getByRole("button", { name: /Create House Fit/ }).click();
  check(
    `house fit "${name}" lands in the pool`,
    await prismaWaitFor(() => prisma.outfit.findFirst({ where: { name } }).then(Boolean))
  );
  // React resets the form once the action responds — wait it out so the
  // next build's name/ticks aren't clobbered by a late reset.
  await admin
    .locator('input[name="pieces"]:checked')
    .first()
    .waitFor({ state: "hidden", timeout: 15000 });
}
async function prismaWaitFor(probe, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await probe()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}
await buildHouseFit("E2E House Alpha", housePieces.slice(0, 2));
await buildHouseFit("E2E House Bravo", housePieces.slice(2, 4));
const houseFits = await prisma.outfit.findMany({
  where: { name: { startsWith: "E2E House" } },
  orderBy: { name: "asc" },
  include: { _count: { select: { items: true } } },
});
check(
  "two house fits saved as HOUSE with 2 pieces each",
  houseFits.length === 2 && houseFits.every((o) => o.kind === "HOUSE" && o._count.items === 2)
);

await admin.reload({ waitUntil: "networkidle" });
const [alpha, bravo] = houseFits;
await admin.selectOption("#outfitAId", alpha.id);
await admin.selectOption("#outfitBId", bravo.id);
await admin.fill("#ob-title", "E2E Fit Check Friday");
await admin.getByRole("button", { name: "Start Fit Battle" }).click();
await admin.getByText("E2E House Alpha vs E2E House Bravo").waitFor({ timeout: 15000 });
const battle = await prisma.outfitBattle.findFirst({
  where: { outfitAId: alpha.id, outfitBId: bravo.id },
});
check("house battle live in the open league", battle?.status === "ACTIVE" && battle?.league === "OPEN");
await admin.screenshot({ path: `${SHOTS}/outfits-admin-studio.png`, fullPage: false });

// One league: a fan fit can face the house head-on
await admin.selectOption("#outfitAId", alpha.id);
await admin.selectOption("#outfitBId", fanFit.id);
await admin.getByRole("button", { name: "Start Fit Battle" }).click();
await admin.getByText("E2E House Alpha vs E2E Fan Fit").waitFor({ timeout: 15000 });
const crossover = await prisma.outfitBattle.findFirst({
  where: { outfitAId: alpha.id, outfitBId: fanFit.id },
});
check("house vs fan crossover allowed", crossover?.status === "ACTIVE" && crossover?.league === "OPEN");

// ---------- Public page renders, fan votes ----------
await page.goto(`${BASE}/outfits`, { waitUntil: "networkidle" });
check("fit battles page shows the matchup title", await page.getByText("E2E Fit Check Friday").isVisible());
check("collages render for both sides", (await page.locator("[data-testid=fit-collage]").count()) >= 2);
await page.screenshot({ path: `${SHOTS}/outfits-public.png`, fullPage: true });

// Both live battles run Alpha as side A, so the first vote button is
// always an Alpha vote regardless of listing order.
await page.getByRole("button", { name: "Vote This Fit" }).first().click();
await page.getByText("Your vote").waitFor({ timeout: 15000 });
const vote = await prisma.outfitVote.findFirst({ where: { userId: fan.id } });
check("outfit vote recorded", vote?.outfitId === alpha.id);
check("results bars show after voting", await page.getByText(/\d+%/).first().isVisible());

// ---------- Outreach: invite a cold lead from the admin panel ----------
const leadUser = await prisma.user.create({
  data: { name: "Outreach Test Lead", email: "outreach-lead@theheatchart.com" },
});
await prisma.artistProfile.create({
  data: {
    userId: leadUser.id,
    slug: LEAD_SLUG,
    displayName: "Outreach Test Lead",
    status: "APPROVED",
  },
});

await admin.reload({ waitUntil: "networkidle" });
await admin.getByText("Outreach", { exact: false }).first().waitFor({ timeout: 10000 });
const leadRow = admin.locator("div.rounded-xl", { hasText: "Outreach Test Lead" }).first();
check("cold lead listed as never invited", await leadRow.getByText("Never invited").isVisible());
await leadRow.locator('input[name="email"]').fill(LEAD_EMAIL);
await leadRow.getByRole("button", { name: "Send Invite" }).click();
// RESEND_API_KEY is unset locally → manual-DM branch with the claim link.
await admin.getByText("Invited today").waitFor({ timeout: 15000 });
check("lead marked invited after send", true);

const relinked = await prisma.artistProfile.findUnique({
  where: { slug: LEAD_SLUG },
  include: { user: true },
});
check("profile relinked to the lead's real email", relinked?.user.email === LEAD_EMAIL);
check("invitedAt stamped", Boolean(relinked?.invitedAt));
const leadAccount = await prisma.user.findUnique({ where: { email: LEAD_EMAIL } });
const token = await prisma.passwordResetToken.findFirst({
  where: { userId: leadAccount?.id ?? "", expires: { gt: new Date() } },
});
check("live 14-day claim token minted", Boolean(token));
await admin.screenshot({ path: `${SHOTS}/outfits-outreach.png`, fullPage: false });

await browser.close();
await prisma.$disconnect();

console.log("\n=== OUTFITS + OUTREACH SUITE ===");
for (const r of results) console.log(r);
