// Mobile app shell: bottom tab bar on phone viewports, hidden on
// desktop; tab navigation; PWA manifest; slim mobile header.
import { devices } from "playwright";
import { BASE, SHOTS, makeChecker, launchBrowser } from "./helpers.mjs";

const results = [];
const check = makeChecker(results);

const browser = await launchBrowser();

// ---------- Phone viewport ----------
const phone = await browser.newContext({ ...devices["iPhone 13"] });
const page = await phone.newPage();

await page.goto(BASE, { waitUntil: "networkidle" });
const tabBar = page.locator("nav[aria-label='Primary']");
check("tab bar visible on phone", await tabBar.isVisible());
check("tab bar has all five tabs",
  (await tabBar.getByText("Home").count()) === 1 &&
  (await tabBar.getByText("Arena").count()) === 1 &&
  (await tabBar.getByText("Heat Check").count()) === 1 &&
  (await tabBar.getByText("Drops").count()) === 1 &&
  (await tabBar.getByText("Profile").count()) === 1
);
check("desktop nav links hidden on phone", !(await page.locator("header").getByText("HEAT LIST").isVisible().catch(() => false)));
await page.screenshot({ path: `${SHOTS}/mobile-home.png` });

// Tab navigation
await tabBar.getByText("Arena").click();
await page.waitForURL("**/battles", { timeout: 10000 });
check("Arena tab navigates to battles", true);
const pills = page.getByText("🏆 Brackets");
await pills.waitFor({ timeout: 10000 }).catch(() => {});
check("arena hub pills present", await pills.isVisible());

await tabBar.getByText("Heat Check").click();
await page.waitForURL("**/quiz", { timeout: 10000 });
check("center flame navigates to quiz", true);
await page.screenshot({ path: `${SHOTS}/mobile-quiz.png` });

await tabBar.getByText("Drops").click();
await page.waitForURL("**/news", { timeout: 10000 });
check("Drops tab navigates to news", true);

await tabBar.getByText("Profile").click();
await page.waitForURL(/\/(profile|signin)/, { timeout: 10000 });
check("Profile tab routes to account area", true);

// PWA manifest
const manifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
check("PWA manifest serves with standalone display", manifest.display === "standalone" && manifest.name === "The Heat Chart");
const icon = await fetch(`${BASE}/icons/icon-192.png`);
check("PWA icon serves", icon.ok && icon.headers.get("content-type")?.includes("png") === true);
const manifestLinked = await page.locator("link[rel='manifest']").count();
check("manifest linked in document head", manifestLinked >= 1);

await phone.close();

// ---------- Desktop viewport ----------
const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const dpage = await desktop.newPage();
await dpage.goto(BASE, { waitUntil: "networkidle" });
check("tab bar hidden on desktop", !(await dpage.locator("nav[aria-label='Primary']").isVisible()));
check("desktop top nav still present", await dpage.locator("header").getByText("Heat List").isVisible());
await desktop.close();

await browser.close();
console.log(results.join("\n"));
