// Accounts + quiz economy: registration, profile, gated voting, the
// strike/credit paywall loop, giveaway entry, password reset, admin
// member visibility.
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { BASE, SHOTS, PNG_1x1, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const EMAIL = "e2e-user@test.example";
const results = [];
const check = makeChecker(results);

await prisma.user.deleteMany({ where: { email: EMAIL } });

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// ---------- Register ----------
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await page.fill("#name", "E2E Tester");
await page.fill("#email", EMAIL);
await page.fill("#password", "supersecret1");
await page.getByRole("button", { name: "Create Account" }).click();
await page.waitForURL("**/profile", { timeout: 15000 });
check("register creates account and signs in", true);

// ---------- Profile ----------
await page.fill("#p-phone", "+1 555 010 2030");
await page.fill("#p-city", "Atlanta, GA");
await page.fill("#p-size", "10.5");
await page.fill("#p-ig", "@e2etester");
await page.check('input[name="marketingOptIn"]');
await page.getByRole("button", { name: "Save Profile" }).click();
await page.getByText("Saved.").waitFor({ timeout: 10000 });
const dbUser = await prisma.user.findUnique({ where: { email: EMAIL } });
check("profile saves contact info", dbUser?.phone === "+1 555 010 2030" && dbUser?.marketingOptIn === true);

// ---------- Voting requires + uses account ----------
await page.goto(`${BASE}/battles`, { waitUntil: "networkidle" });
await page.locator("a[href^='/battles/']").first().click();
await page.waitForURL("**/battles/**");
const voteBtns = page.getByRole("button", { name: "Vote This Shoe" });
if ((await voteBtns.count()) === 2) {
  await voteBtns.first().click();
  await page.getByText("Your vote").first().waitFor({ timeout: 10000 });
  const vote = await prisma.vote.findFirst({ where: { userId: dbUser.id } });
  check("logged-in vote recorded against account", Boolean(vote));
} else {
  check("logged-in vote recorded against account", false, "no active battle with vote buttons");
}

// ---------- Quiz: strikes → paywall → purchase → win ----------
await page.goto(`${BASE}/quiz`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Start The Heat Check" }).click();
await page.locator("h2").waitFor({ timeout: 10000 });
check("quiz run starts with a question", true);

async function currentQuestion() {
  const text = (await page.locator("h2").first().textContent())?.trim();
  return prisma.quizQuestion.findFirst({ where: { question: text ?? "" } });
}

async function clickOption(index) {
  const before = (await page.locator("h2").first().textContent())?.trim();
  await page.locator("div.space-y-3 > button").nth(index).click();
  // Terminal headings use the .display class, so page copy can't false-match.
  await page.waitForFunction(
    (prev) => {
      const headings = [...document.querySelectorAll(".display")].map((el) => el.textContent.trim());
      const blocked = headings.some((t) =>
        t.startsWith("Out of strikes") || t.startsWith("Heat Check Passed") || t.startsWith("Run over")
      );
      const h2 = document.querySelector("h2");
      return blocked || (h2 && h2.textContent.trim() !== prev);
    },
    before,
    { timeout: 15000 }
  );
}

let sawNeedsCredits = false;
for (let i = 0; i < 4; i++) {
  const q = await currentQuestion();
  if (!q) break;
  await clickOption((q.answerIndex + 1) % 4);
  if (await page.locator(".display", { hasText: "Out of strikes" }).isVisible().catch(() => false)) {
    sawNeedsCredits = true;
    break;
  }
}
check("3 free strikes then paywall appears", sawNeedsCredits);
await page.screenshot({ path: `${SHOTS}/quiz-paywall.png`, fullPage: true });

await page.getByRole("button", { name: /Buy 4 Strikes/ }).click();
await page.locator("h2").waitFor({ timeout: 15000 });
const afterBuy = await prisma.user.findUnique({ where: { email: EMAIL } });
check("dev credit purchase grants strikes and resumes run", afterBuy.credits >= 3);

let won = false;
for (let i = 0; i < 40; i++) {
  if (await page.getByText("Heat Check Passed").isVisible().catch(() => false)) {
    won = true;
    break;
  }
  const q = await currentQuestion();
  if (!q) break;
  await clickOption(q.answerIndex);
}
if (!won) won = await page.getByText("Heat Check Passed").isVisible().catch(() => false);
check("answering 12 correct passes the heat check", won);

const entry = await prisma.giveawayEntry.findFirst({ where: { userId: dbUser.id } });
check("heat check win creates giveaway entry", Boolean(entry));

// ---------- Giveaway page ----------
await page.goto(`${BASE}/giveaway`, { waitUntil: "networkidle" });
check("giveaway page shows your entries", await page.getByText(/You have 1 entr/).isVisible());
check("no-purchase-necessary language present", await page.getByText("No purchase necessary").first().isVisible());

// ---------- Sign out → voting gated ----------
await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForTimeout(1500);
await page.goto(`${BASE}/battles`, { waitUntil: "networkidle" });
await page.locator("a[href^='/battles/']").first().click();
await page.waitForURL("**/battles/**");
check("logged-out users see Sign In To Vote", (await page.getByText("Sign In To Vote").count()) > 0);

// ---------- Password reset (via mailer log fallback) ----------
await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.getByRole("button", { name: "Send Reset Link" }).click();
await page.getByText("reset link is on its way").waitFor({ timeout: 10000 });

if (process.env.SERVER_LOG) {
  await new Promise((r) => setTimeout(r, 1000));
  const log = readFileSync(process.env.SERVER_LOG, "utf8");
  const links = log.match(new RegExp(`${BASE.replace(/[/.:]/g, "\\$&")}/reset-password/[a-f0-9]+`, "g")) ?? [];
  const resetUrl = links[links.length - 1];
  check("reset link delivered via mailer fallback (server log)", Boolean(resetUrl));

  await page.goto(resetUrl, { waitUntil: "networkidle" });
  await page.fill("#password", "newpassword99");
  await page.getByRole("button", { name: "Set New Password" }).click();
  await page.getByText("Password updated.").waitFor({ timeout: 10000 });

  await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", "newpassword99");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL("**/profile", { timeout: 15000 });
  check("sign in works with the new password", true);
} else {
  console.log("SKIP password-reset link checks (set SERVER_LOG to enable)");
  // Sign back in for the admin checks below.
  await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", "supersecret1");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL("**/profile", { timeout: 15000 });
}

// ---------- Admin sees the member ----------
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.fill("#password", ADMIN_PASSWORD);
await page.getByRole("button", { name: "Enter" }).click();
await page.getByText("Members").waitFor({ timeout: 10000 });
check("admin members table lists user + phone", await page.getByText("+1 555 010 2030").isVisible());

const csvResp = await ctx.request.get(`${BASE}/api/admin/users.csv`);
const csv = await csvResp.text();
check("admin CSV export includes contact info", csvResp.ok() && csv.includes(EMAIL) && csv.includes("Atlanta"));

// ---------- Cleanup ----------
await prisma.user.deleteMany({ where: { email: EMAIL } });

await browser.close();
await prisma.$disconnect();
console.log(results.join("\n"));
