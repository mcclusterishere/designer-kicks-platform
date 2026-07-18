// Tournament engine: bracket rendering, live final, admin round-forcing,
// advancement, and champion crowning. Reseeds the demo data afterwards
// (forcing the final mutates the demo tournament).
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { BASE, SHOTS, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const results = [];
const check = makeChecker(results);

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Listing shows the demo tournament
await page.goto(`${BASE}/tournaments`, { waitUntil: "networkidle" });
check("tournament listed as live", await page.getByText("Summer Heat Championship").first().isVisible());

// Bracket page: rounds, decided semis, live final
await page.goto(`${BASE}/tournaments/summer-heat-championship`, { waitUntil: "networkidle" });
check("bracket shows semifinals column", await page.getByText("Semifinals").first().isVisible());
check("bracket shows final column", await page.getByText("Final", { exact: true }).first().isVisible());
check("decided matches show winners", (await page.locator("text=✓").count()) >= 2);
check("live final offers voting", await page.getByText("Vote now").first().isVisible());
await page.screenshot({ path: `${SHOTS}/bracket-live.png`, fullPage: true });

// Battles page carries the tournament strip
await page.goto(`${BASE}/battles`, { waitUntil: "networkidle" });
check("battles page shows tournament strip", await page.getByText("Tournament in progress").isVisible());

// Match cards link into ordinary battle vote pages
await page.goto(`${BASE}/tournaments/summer-heat-championship`, { waitUntil: "networkidle" });
const matchLinks = await page.locator("a[href^='/battles/']").count();
check("bracket matches link to battle pages", matchLinks >= 3);

// Admin: force the final to end → winner advances → champion crowned
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.fill("#password", ADMIN_PASSWORD);
await page.getByRole("button", { name: "Enter" }).click();
await page.getByText("Tournaments").first().waitFor({ timeout: 10000 });
await page.getByRole("button", { name: "End round now" }).click();
await page.waitForTimeout(2000);

const t = await prisma.tournament.findUnique({
  where: { slug: "summer-heat-championship" },
  include: { champion: true },
});
check("forcing the final completes the tournament", t?.status === "COMPLETED");
check("champion recorded (Bred Heat 11s led 11-8)", t?.champion?.title === "Bred Heat 11s");

await page.goto(`${BASE}/tournaments/summer-heat-championship`, { waitUntil: "networkidle" });
check("bracket page shows champion banner", await page.getByText("Champion", { exact: true }).isVisible());
await page.screenshot({ path: `${SHOTS}/bracket-champion.png`, fullPage: true });

// Listing moves it to past champions
await page.goto(`${BASE}/tournaments`, { waitUntil: "networkidle" });
check("listing shows past champion", await page.getByText("Past Champions").isVisible());

await browser.close();
await prisma.$disconnect();

// Restore demo data (the forced finish consumed the live final).
execSync("npm run db:seed", { stdio: "ignore" });
console.log(results.join("\n"));
