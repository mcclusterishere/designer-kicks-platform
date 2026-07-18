// Store Scout (beta): the admin prospecting board — manual add, the
// no-website target flag, brand research → QUALIFIED, the verified-
// store invite (copy-paste fallback without Resend), and pipeline
// verdicts. Google scanning is exercised only for its no-key guidance
// (the API isn't reachable from CI).
import { PrismaClient } from "@prisma/client";
import { BASE, SHOTS, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();
const results = [];
const check = makeChecker(results);

await prisma.storeLead.deleteMany({ where: { name: { startsWith: "E2E " } } });

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const admin = await ctx.newPage();

await admin.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await admin.fill("#password", ADMIN_PASSWORD);
await admin.getByRole("button", { name: "Enter" }).click();
await admin.getByRole("heading", { name: /Store/ }).waitFor({ timeout: 10000 });
check("store scout section renders with beta tag", await admin.getByText("Beta", { exact: true }).first().isVisible());

// No Places key locally → the scout form teaches the setup instead
check(
  "missing Places key explained inline",
  await admin.getByText("GOOGLE_PLACES_API_KEY").first().isVisible()
);

// ---------- Manual add (the no-website target) ----------
await admin.getByText("Add a store by hand", { exact: false }).click();
await admin.fill("#ms-name", "E2E Corner Kicks");
await admin.fill("#ms-addr", "500 Test Blvd, Atlanta, GA");
await admin.fill("#ms-zip", "30310");
await admin.fill("#ms-phone", "(404) 555-0199");
await admin.getByRole("button", { name: "Add Store By Hand" }).click();
await admin.getByText("E2E Corner Kicks").first().waitFor({ timeout: 15000 });
const lead = await prisma.storeLead.findFirst({ where: { name: "E2E Corner Kicks" } });
check("manual lead saved as SCOUTED", lead?.status === "SCOUTED" && lead?.website === null);

const row = admin.locator("div.rounded-xl", { hasText: "E2E Corner Kicks" }).first();
check("no-website target badge shows", await row.getByText("No Website — Target").isVisible());

// Duplicate guard
await admin.fill("#ms-name", "E2E Corner Kicks");
await admin.fill("#ms-zip", "30310");
await admin.getByRole("button", { name: "Add Store By Hand" }).click();
await admin.getByText("already on the board").waitFor({ timeout: 15000 });
check("duplicate store refused", true);

// ---------- Research → QUALIFIED ----------
await row.getByRole("button", { name: "work this lead" }).click();
check("research links offered", await row.getByText("Find their IG").isVisible());
await row.locator(`input[name="email"]`).fill("owner@cornerkicks.example");
await row.locator(`input[name="instagram"]`).fill("@cornerkicksatl");
await row.locator(`input[name="specialty"]`).fill("consignment + customs");
await row.locator(`textarea[name="notes"]`).fill("Since 2018, heavy Jordan wall, no site anywhere.");
await row.getByRole("button", { name: "Save Research" }).click();
await row.getByText("Saved ✓").waitFor({ timeout: 15000 });
const qualified = await prisma.storeLead.findFirst({ where: { name: "E2E Corner Kicks" } });
check(
  "research saved and email qualifies the lead",
  qualified?.status === "QUALIFIED" && qualified?.instagram === "cornerkicksatl"
);

// ---------- Invite (no Resend key → copy-paste pitch) ----------
await row.getByRole("button", { name: "Send Verified-Store Invite" }).click();
await row.getByText("Marked invited ✓", { exact: false }).waitFor({ timeout: 15000 });
const pitchBox = row.locator("textarea[readonly]");
const pitch = await pitchBox.inputValue();
check("pitch carries the verified-store offer", pitch.includes("HEAT CHART VERIFIED STORES") && pitch.includes("1%"));
check("pitch is personal to the store", pitch.includes("E2E Corner Kicks") && pitch.includes("cornerkicksatl"));
const invited = await prisma.storeLead.findFirst({ where: { name: "E2E Corner Kicks" } });
check("lead marked INVITED with timestamp", invited?.status === "INVITED" && Boolean(invited?.invitedAt));
await admin.screenshot({ path: `${SHOTS}/store-scout.png`, fullPage: false });

// ---------- Verdict: they joined ----------
await admin.reload({ waitUntil: "networkidle" });
const row2 = admin.locator("div.rounded-xl", { hasText: "E2E Corner Kicks" }).first();
await row2.getByRole("button", { name: "work this lead" }).click();
await row2.getByRole("button", { name: /mark Joined/ }).click();
await admin.getByText("Verified stores (", { exact: false }).waitFor({ timeout: 15000 });
const joined = await prisma.storeLead.findFirst({ where: { name: "E2E Corner Kicks" } });
check("verdict lands in verified stores", joined?.status === "JOINED");

// ---------- Beta stays private ----------
const guest = await (await browser.newContext()).newPage();
const resp = await guest.goto(`${BASE}/stores`, { waitUntil: "domcontentloaded" });
check("no public stores page in beta", resp?.status() === 404);

await browser.close();
await prisma.$disconnect();

console.log("\n=== STORE SCOUT SUITE ===");
for (const r of results) console.log(r);
