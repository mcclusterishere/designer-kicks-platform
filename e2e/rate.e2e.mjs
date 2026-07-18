// The Rate game + taste engine: a fan scores designs out of five
// flames, the community average reveals, the taste profile appears on
// their profile, and the admin Taste Pulse picks it all up.
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { BASE, SHOTS, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const EMAIL = "rate-fan@test.example";
const results = [];
const check = makeChecker(results);

// Fresh fan created directly (register stays under its rate limit).
await prisma.user.deleteMany({ where: { email: EMAIL } });
const fan = await prisma.user.create({
  data: { name: "Rate Fan", email: EMAIL, passwordHash: await hash("ratepass99", 10) },
});

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", "ratepass99");
await page.getByRole("button", { name: "Sign In", exact: true }).click();
await page.waitForURL("**/profile", { timeout: 15000 });

// ---------- The deck ----------
await page.goto(`${BASE}/rate`, { waitUntil: "networkidle" });
await page.locator("[data-testid=rate-card]").waitFor({ timeout: 10000 });
check("deck deals a card", true);
await page.screenshot({ path: `${SHOTS}/rate-deck.png`, fullPage: false });

const firstTitle = await page.locator("[data-testid=rate-card] h2").innerText();
await page.getByRole("button", { name: "4 flames" }).click();
await page.locator("[data-testid=rate-reveal]").waitFor({ timeout: 10000 });
check(
  "community verdict reveals after rating",
  (await page.locator("[data-testid=rate-reveal]").innerText()).includes("the culture says")
);
await page.screenshot({ path: `${SHOTS}/rate-reveal.png`, fullPage: false });
const first = await prisma.designRating.findFirst({ where: { userId: fan.id } });
check("4-flame rating stored", first?.stars === 4);

// Wait until the deck settles on a NEW card (exit animation done).
async function cardSettled(prevTitle) {
  await page.waitForFunction(
    (prev) => {
      const h = document.querySelector("[data-testid=rate-card] h2");
      return h && h.textContent !== prev && !document.querySelector(".rate-card-exit");
    },
    prevTitle,
    { timeout: 15000 }
  );
}
// Card auto-advances after the reveal
await page.locator("[data-testid=rate-reveal]").waitFor({ state: "detached", timeout: 8000 });
await cardSettled(firstTitle);

// Pass skips without rating
const secondTitle = await page.locator("[data-testid=rate-card] h2").innerText();
await page.getByRole("button", { name: /Pass — show me another/ }).click();
await cardSettled(secondTitle);
check("pass skips without storing a rating", (await prisma.designRating.count({ where: { userId: fan.id } })) === 1);

// A 5-flame banger
await page.getByRole("button", { name: "5 flames" }).click();
await page.locator("[data-testid=rate-reveal]").waitFor({ timeout: 10000 });
const ratings = await prisma.designRating.findMany({ where: { userId: fan.id } });
check(
  "second rating stored at 5 flames",
  ratings.length === 2 && ratings.some((r) => r.stars === 5)
);

// ---------- Taste profile on the fan's profile ----------
await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: /Taste/ }).waitFor({ timeout: 10000 });
check("taste section renders", true);
check("taste profile built from signals", await page.getByText(/Built from \d+ signal/).isVisible());
check("archetype title shown", await page.locator("#taste .display").first().isVisible());
await page.screenshot({ path: `${SHOTS}/rate-taste-profile.png`, fullPage: false });

// ---------- Admin Taste Pulse ----------
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await adminCtx.newPage();
await admin.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await admin.fill("#password", ADMIN_PASSWORD);
await admin.getByRole("button", { name: "Enter" }).click();
await admin.getByText("Brand Heat", { exact: false }).waitFor({ timeout: 10000 });
check("admin sees Brand Heat board", true);
check("admin sees Silhouette Heat board", await admin.getByText("Silhouette Heat", { exact: false }).isVisible());
check("ratings tile counts the plays", await admin.getByText("Design ratings").isVisible());
check("top rated board lists pieces", await admin.getByText("Top rated in the Rate game").isVisible());
await admin.screenshot({ path: `${SHOTS}/rate-taste-pulse.png`, fullPage: false });

// ---------- Signed-out teaser ----------
const guestCtx = await browser.newContext({ viewport: { width: 430, height: 900 } });
const guest = await guestCtx.newPage();
await guest.goto(`${BASE}/rate`, { waitUntil: "networkidle" });
check("guests get the sign-in pitch", await guest.getByText("Sign In To Play").isVisible());

await browser.close();
await prisma.$disconnect();

console.log("\n=== RATE + TASTE SUITE ===");
for (const r of results) console.log(r);
