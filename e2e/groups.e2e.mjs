// Group Scout: the hand-worked FB-group pipeline — add a group, walk
// its stage, save notes, and get the tagged link that makes Traffic
// Pulse attribute the clicks.
import { PrismaClient } from "@prisma/client";
import { BASE, SHOTS, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const results = [];
const check = makeChecker(results);
const NAME = "E2E Custom Kicks Nation";

await prisma.groupLead.deleteMany({ where: { name: NAME } });

const browser = await launchBrowser();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.fill("#password", ADMIN_PASSWORD);
await page.getByRole("button", { name: "Enter" }).click();
await page.getByRole("heading", { name: "Group Scout" }).waitFor({ timeout: 10000 });
check("admin sees Group Scout", true);

await page.fill("#gr-name", NAME);
await page.fill("#gr-url", "https://facebook.com/groups/e2ekicks");
await page.fill("#gr-admin", "Test Admin");
await page.fill("#gr-members", "12K");
await page.getByRole("button", { name: "Track This Group" }).click();
const row = page.locator("div.rounded-xl", { hasText: NAME }).first();
await row.waitFor({ timeout: 15000 });
check("group lands on the board", true);
const lead = await prisma.groupLead.findFirst({ where: { name: NAME } });
check("campaign slug minted", lead?.campaign === "e2e-custom-kicks-nation");
check(
  "tagged link carries the campaign",
  (await row.locator("input[readonly]").inputValue()).includes(
    "utm_source=fbgroup&utm_medium=social&utm_campaign=e2e-custom-kicks-nation"
  )
);

await row.getByRole("button", { name: "→ Contacted" }).click();
await row.getByText("Contacted", { exact: true }).waitFor({ timeout: 15000 });
check(
  "stage advances",
  (await prisma.groupLead.findFirst({ where: { name: NAME } }))?.stage === "CONTACTED"
);
await row.locator('input[name="notes"]').fill("Admin replied, wants examples");
await row.getByRole("button", { name: "save" }).click();
await row.getByText("saved ✓").waitFor({ timeout: 15000 });
check(
  "notes persist",
  (await prisma.groupLead.findFirst({ where: { name: NAME } }))?.notes === "Admin replied, wants examples"
);
await page.screenshot({ path: `${SHOTS}/group-scout.png`, fullPage: false });

await prisma.groupLead.deleteMany({ where: { name: NAME } });
await browser.close();
await prisma.$disconnect();

console.log("\n=== GROUP SCOUT SUITE ===");
for (const r of results) console.log(r);
