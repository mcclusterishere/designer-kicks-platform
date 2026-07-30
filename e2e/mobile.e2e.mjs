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
// The five doors are asserted one at a time further down, where a failure
// names the missing tab instead of just saying "not five".
check("desktop nav links hidden on phone", !(await page.locator("header").getByText("HEAT LIST").isVisible().catch(() => false)));
await page.screenshot({ path: `${SHOTS}/mobile-home.png` });

// Tab navigation
await tabBar.getByText("Arena").click();
await page.waitForURL("**/battles", { timeout: 10000 });
check("Arena tab navigates to battles", true);
// The arena hub links to Brackets twice — once as an emoji chip in the
// "more ways to compete" rail, once in the section tabs. Either one being
// on screen is the thing worth asserting.
const pills = page.getByRole("link", { name: /Brackets/ });
await pills.first().waitFor({ timeout: 10000 }).catch(() => {});
check("arena hub pills present", (await pills.count()) > 0);

// The bar is five doors — Home, Market, Arena, Drops, Profile. Heat Check
// stopped being one of them when the nav was cut down; it's reached from
// the games hub now, so the suite checks the bar holds what it claims to
// and opens the quiz by address.
const TABS = ["Home", "Market", "Arena", "Drops", "Profile"];
for (const t of TABS) {
  check(`tab bar has ${t}`, (await tabBar.getByText(t, { exact: true }).count()) > 0);
}
await page.goto(`${BASE}/quiz`, { waitUntil: "networkidle" });
check("quiz opens", page.url().includes("/quiz"));
await page.screenshot({ path: `${SHOTS}/mobile-quiz.png` });

await tabBar.getByText("Drops").click();
await page.waitForURL("**/drops", { timeout: 10000 });
check("Drops tab opens the calendar", true);

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
check("desktop top nav still present", await dpage.locator("header").getByText("Arena").isVisible());
await desktop.close();

await browser.close();
console.log(results.join("\n"));
