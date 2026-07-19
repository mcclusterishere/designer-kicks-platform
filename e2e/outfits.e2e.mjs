// Fit Battles + Outreach: a fan builds an outfit from owned pieces,
// the admin curates house fits and matches a battle, the public page
// renders and takes votes, and the admin outreach module invites a
// cold lead with a claim link.
import { PrismaClient } from "@prisma/client";
import { BASE, SHOTS, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const FAN_EMAIL = "outfit-fan@test.example";
const FAN2_EMAIL = "outfit-fan2@test.example";
const LEAD_EMAIL = "outreach-lead@test.example";
const LEAD_SLUG = "outreach-test-lead";
const results = [];
const check = makeChecker(results);

// ---------- Cleanup from prior runs ----------
await prisma.outfitBattle.deleteMany({
  where: { OR: [{ outfitA: { name: { startsWith: "E2E " } } }, { outfitB: { name: { startsWith: "E2E " } } }] },
});
await prisma.outfit.deleteMany({ where: { name: { startsWith: "E2E " } } });
await prisma.submission.deleteMany({ where: { title: { startsWith: "E2E Fit Piece" } } });
await prisma.user.deleteMany({ where: { email: { startsWith: "e2e-heat-rater" } } });
await prisma.artistProfile.deleteMany({ where: { slug: LEAD_SLUG } });
await prisma.submission.deleteMany({ where: { title: { startsWith: "E2E Fit Piece" } } });
await prisma.user.deleteMany({ where: { OR: [{ email: { in: [FAN_EMAIL, FAN2_EMAIL, LEAD_EMAIL, "outreach-lead@theheatchart.com"] } }, { email: { startsWith: "e2e-heat-rater" } }] } });

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// ---------- Fan registers and gets a closet ----------
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await page.fill("#name", "Outfit Fan");
await page.fill("#email", FAN_EMAIL);
await page.fill("#password", "fitcheck99");
await page.check("#age13");
await page.getByRole("button", { name: "Create Account" }).click();
await page.waitForURL("**/profile", { timeout: 15000 });
const fan = await prisma.user.findUnique({ where: { email: FAN_EMAIL } });
check("fan account created", Boolean(fan));

// Dedicated fixture pieces, one per category. A full outfit is three
// pieces — one pair of kicks, one apparel, one accessory.
const mkPiece = (title, category, ownerId = null) => ({
  title,
  artistName: "E2E Fit Forge",
  email: FAN_EMAIL,
  baseShoe: "Fixture blank",
  imageUrl: "/seed/custom-1.svg",
  status: "APPROVED",
  category,
  ownerId,
});
// The fan owns a full look: kicks + apparel + accessory.
const fKicks = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Fan Kicks", "sneakers", fan.id) });
const fVest = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Fan Vest", "apparel", fan.id) });
const fChain = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Fan Chain", "accessories", fan.id) });
// A second fan with their own full look — for a real Fan-League matchup.
const fan2 = await prisma.user.create({ data: { name: "Outfit Fan Two", email: FAN2_EMAIL } });
const g1 = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Fan2 Kicks", "sneakers", fan2.id) });
const g2 = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Fan2 Vest", "apparel", fan2.id) });
const g3 = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Fan2 Chain", "accessories", fan2.id) });
const fan2Fit = await prisma.outfit.create({
  data: {
    name: "E2E Fan Two Fit",
    kind: "FAN",
    ownerId: fan2.id,
    items: { create: [g1, g2, g3].map((p) => ({ submissionId: p.id })) },
  },
});
// House pieces (unowned) — two full house looks + a hot look.
const aKicks = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Alpha Kicks", "sneakers") });
const aVest = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Alpha Vest", "apparel") });
const aChain = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Alpha Chain", "accessories") });
const bKicks = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Bravo Kicks", "sneakers") });
const bVest = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Bravo Vest", "apparel") });
const bChain = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Bravo Chain", "accessories") });
const hKicks = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Hot Kicks", "sneakers") });
const hVest = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Hot Vest", "apparel") });
const hChain = await prisma.submission.create({ data: mkPiece("E2E Fit Piece Hot Chain", "accessories") });
// Six 5-flame ratings each push the hot look to ~4.5 heat (Bayesian).
for (let i = 0; i < 6; i++) {
  const rater = await prisma.user.create({
    data: { name: `Heat Rater ${i}`, email: `e2e-heat-rater-${i}@test.example` },
  });
  await prisma.designRating.createMany({
    data: [hKicks, hVest, hChain].map((p) => ({ submissionId: p.id, userId: rater.id, stars: 5 })),
  });
}
check("fan closet holds a full look", true);

// ---------- Fan builds a full fit from their closet ----------
await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: /Build a Fit/ }).waitFor({ timeout: 10000 });
await page.fill("#fit-name", "E2E Fan Fit");
for (const s of [fKicks, fVest, fChain]) {
  await page.locator(`label:has(input[name="pieces"][value="${s.id}"])`).click();
}
await page.getByRole("button", { name: "Enter The Fan Fit League" }).click();
await page.getByText("Fit submitted").waitFor({ timeout: 15000 });
const fanFit = await prisma.outfit.findFirst({
  where: { name: "E2E Fan Fit" },
  include: { _count: { select: { items: true } } },
});
check("fan fit saved as FAN with 3 pieces", fanFit?.kind === "FAN" && fanFit?._count.items === 3 && fanFit?.ownerId === fan.id);
await page.screenshot({ path: `${SHOTS}/outfits-fan-builder.png` });

// ---------- Admin curates house fits and matches battles ----------
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await adminCtx.newPage();
await admin.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await admin.fill("#password", ADMIN_PASSWORD);
await admin.getByRole("button", { name: "Enter" }).click();
await admin.getByRole("heading", { name: "Outfit Studio" }).waitFor({ timeout: 10000 });
check("admin sees Outfit Studio", true);
check("admin sees category leaders", (await admin.getByText(/Top sneakers/).count()) === 1);

async function prismaWaitFor(probe, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await probe()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}
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
  await admin
    .locator('input[name="pieces"]:checked')
    .first()
    .waitFor({ state: "hidden", timeout: 15000 });
}

// Full-outfit rule inside the builder: three pieces but a duplicate
// category (two kicks, no accessory) must be refused.
await admin.fill("#ho-name", "E2E Illegal Partial");
await admin.locator(`input[name="pieces"][value="${aKicks.id}"]`).setChecked(true);
await admin.locator(`input[name="pieces"][value="${bKicks.id}"]`).setChecked(true);
await admin.locator(`input[name="pieces"][value="${aVest.id}"]`).setChecked(true);
await admin.getByRole("button", { name: /Create House Fit/ }).click();
await admin.getByText(/one from each category/i).waitFor({ timeout: 15000 });
check("dupe-category fit refused", true);
await admin.locator(`input[name="pieces"][value="${aKicks.id}"]`).setChecked(false);
await admin.locator(`input[name="pieces"][value="${bKicks.id}"]`).setChecked(false);
await admin.locator(`input[name="pieces"][value="${aVest.id}"]`).setChecked(false);

await buildHouseFit("E2E House Alpha", [aKicks, aVest, aChain]);
await buildHouseFit("E2E House Bravo", [bKicks, bVest, bChain]);
const houseFits = await prisma.outfit.findMany({
  where: { name: { in: ["E2E House Alpha", "E2E House Bravo"] } },
  orderBy: { name: "asc" },
  include: { _count: { select: { items: true } } },
});
check(
  "two house fits saved as HOUSE with 3 pieces each",
  houseFits.length === 2 && houseFits.every((o) => o.kind === "HOUSE" && o._count.items === 3)
);

await admin.reload({ waitUntil: "networkidle" });
const [alpha, bravo] = houseFits;

// Curator Battle: house vs house.
await admin.selectOption("#outfitAId", alpha.id);
await admin.selectOption("#outfitBId", bravo.id);
await admin.fill("#ob-title", "E2E Curator Friday");
await admin.getByRole("button", { name: "Start Fit Battle" }).click();
await admin.getByText("E2E House Alpha vs E2E House Bravo").waitFor({ timeout: 15000 });
const houseBattle = await prisma.outfitBattle.findFirst({ where: { outfitAId: alpha.id, outfitBId: bravo.id } });
check("curator battle lives in the HOUSE league", houseBattle?.status === "ACTIVE" && houseBattle?.league === "HOUSE");
await admin.screenshot({ path: `${SHOTS}/outfits-admin-studio.png`, fullPage: false });

// Fan Fit League: fan vs fan.
await admin.reload({ waitUntil: "networkidle" });
await admin.selectOption("#outfitAId", fanFit.id);
await admin.selectOption("#outfitBId", fan2Fit.id);
await admin.fill("#ob-title", "E2E Fan League Bout");
await admin.getByRole("button", { name: "Start Fit Battle" }).click();
await admin.getByText("E2E Fan Fit vs E2E Fan Two Fit").waitFor({ timeout: 15000 });
const fanBattle = await prisma.outfitBattle.findFirst({ where: { outfitAId: fanFit.id, outfitBId: fan2Fit.id } });
check("fan-vs-fan battle lives in the FAN league", fanBattle?.status === "ACTIVE" && fanBattle?.league === "FAN");

// Leagues never cross: a fan fit can't be matched against a house fit.
await admin.reload({ waitUntil: "networkidle" });
await admin.selectOption("#outfitAId", alpha.id);
await admin.selectOption("#outfitBId", fanFit.id);
await admin.getByRole("button", { name: "Start Fit Battle" }).click();
await admin.getByText(/never one of each/).waitFor({ timeout: 15000 });
check("house-vs-fan crossover refused", true);
check(
  "no crossover battle stored",
  !(await prisma.outfitBattle.findFirst({ where: { outfitAId: alpha.id, outfitBId: fanFit.id } }))
);

// Fair-fight wall: heat-mismatched fits can't battle.
await buildHouseFit("E2E House Hot", [hKicks, hVest, hChain]);
const hotFit = await prisma.outfit.findFirst({ where: { name: "E2E House Hot" } });
await admin.reload({ waitUntil: "networkidle" });
await admin.selectOption("#outfitAId", hotFit.id);
await admin.selectOption("#outfitBId", bravo.id);
await admin.getByRole("button", { name: "Start Fit Battle" }).click();
await admin.getByText(/Heat mismatch/).waitFor({ timeout: 15000 });
check("heat-mismatched fits refused", true);
check(
  "no mismatch battle stored",
  !(await prisma.outfitBattle.findFirst({ where: { outfitAId: hotFit.id } }))
);

// ---------- Public page renders, fan votes ----------
await page.goto(`${BASE}/outfits`, { waitUntil: "networkidle" });
check("fan fit league section shows", await page.getByRole("heading", { name: "Fan Fit League" }).isVisible());
check("curator battles section shows", await page.getByRole("heading", { name: "Curator Battles" }).isVisible());
check("curator matchup title renders", await page.getByText("E2E Curator Friday").isVisible());
check("collages render for the sides", (await page.locator("[data-testid=fit-collage]").count()) >= 2);
await page.screenshot({ path: `${SHOTS}/outfits-public.png`, fullPage: true });

// Vote in the curator battle (Alpha is side A).
await page.getByRole("button", { name: "Vote This Fit" }).first().click();
await page.getByText("Your vote").waitFor({ timeout: 15000 });
const vote = await prisma.outfitVote.findFirst({ where: { userId: fan.id } });
check("outfit vote recorded", Boolean(vote));
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

// Pipeline tracker: stage chips + notes
check("lead starts in NEW stage", await leadRow.getByText("New", { exact: true }).isVisible());
await leadRow.getByRole("button", { name: "→ Contacted" }).click();
await leadRow.getByText("Contacted", { exact: true }).waitFor({ timeout: 15000 });
const staged = await prisma.artistProfile.findUnique({ where: { slug: LEAD_SLUG } });
check("stage advances to CONTACTED", staged?.outreachStage === "CONTACTED");
await leadRow.locator('input[name="notes"]').fill("DM'd on FB, replied interested");
await leadRow.getByRole("button", { name: "save" }).click();
await leadRow.getByText("saved ✓").waitFor({ timeout: 15000 });
const noted = await prisma.artistProfile.findUnique({ where: { slug: LEAD_SLUG } });
check("notes persist on the lead", noted?.outreachNotes === "DM'd on FB, replied interested");

// The no-email path: a personalized paste-ready DM with the claim link
await leadRow.getByRole("button", { name: "DM script" }).click();
const dmBox = leadRow.locator("[data-testid=dm-script]");
await dmBox.waitFor({ timeout: 15000 });
const dmText = await dmBox.inputValue();
check(
  "DM script personalized with the claim link",
  dmText.includes("Outreach Test Lead") && dmText.includes("/reset-password/")
);
// Asking again must reuse the same live link, never rotate it
const tokenBefore = dmText.match(/reset-password\/(\w+)/)?.[1];
await leadRow.getByRole("button", { name: "DM script" }).click();
await admin.waitForTimeout(800);
const tokenAfter = (await dmBox.inputValue()).match(/reset-password\/(\w+)/)?.[1];
check("DM script never rotates a live claim link", Boolean(tokenBefore) && tokenBefore === tokenAfter);
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
check("invite auto-advances pipeline to INVITED", relinked?.outreachStage === "INVITED");
const leadAccount = await prisma.user.findUnique({ where: { email: LEAD_EMAIL } });
const token = await prisma.passwordResetToken.findFirst({
  where: { userId: leadAccount?.id ?? "", expires: { gt: new Date() } },
});
check("live 14-day claim token minted", Boolean(token));
await admin.screenshot({ path: `${SHOTS}/outfits-outreach.png`, fullPage: false });

// Fixture teardown: dedicated pieces, their fits, and the rater crew.
await prisma.outfitBattle.deleteMany({
  where: { OR: [{ outfitA: { name: { startsWith: "E2E " } } }, { outfitB: { name: { startsWith: "E2E " } } }] },
});
await prisma.outfit.deleteMany({ where: { name: { startsWith: "E2E " } } });
await prisma.submission.deleteMany({ where: { title: { startsWith: "E2E Fit Piece" } } });
await prisma.user.deleteMany({ where: { OR: [{ email: { startsWith: "e2e-heat-rater" } }, { email: FAN2_EMAIL }] } });

await browser.close();
await prisma.$disconnect();

console.log("\n=== OUTFITS + OUTREACH SUITE ===");
for (const r of results) console.log(r);
