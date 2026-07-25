// The money surfaces, rendered in a real browser as a signed-in member.
//
// This suite exists because of a specific failure: a client-only hook used
// inside a server component typechecks cleanly and builds cleanly, and then
// throws on every request. `npm run build` said the market was fine while
// the market was down. Only actually loading the page catches that class of
// bug, so the pages that move credits get loaded here, and any console or
// page error fails the run.
//
// The ledger's own invariants — atomicity, idempotency, overdraft, limits,
// reconciliation — are proved separately and without a browser by
// `npm run verify:ledger`.
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { BASE, SHOTS, makeChecker, launchBrowser } from "./helpers.mjs";

const prisma = new PrismaClient();
const results = [];
const check = makeChecker(results);

const EMAIL = `money-e2e-${process.pid}@example.invalid`;
const PASS = "MoneySuite!2026";

const member = await prisma.user.create({
  data: {
    email: EMAIL,
    name: "Money Suite",
    passwordHash: await hash(PASS, 10),
    // Registration stamps this; a member created straight in the database
    // hasn't got it, and the PMA gate then covers every page and swallows
    // every click. Real members have accepted, so the fixture does too.
    pmaAcceptedAt: new Date(),
  },
});
// Funded the way the app funds people, so the suite never leaves the books
// disagreeing with themselves.
await prisma.$transaction(async (tx) => {
  await tx.user.update({ where: { id: member.id }, data: { credits: 120 } });
  await tx.creditTransaction.create({
    data: { userId: member.id, delta: 120, reason: "e2e-seed", balanceAfter: 120 },
  });
});

const browser = await launchBrowser();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

try {
  // networkidle before filling: the form is hydrated by React, and typing
  // into it before hydration loses the values. Then wait for the landing
  // page rather than for the page to "look idle" — networkidle after the
  // click resolves before the POST is even in flight.
  await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/profile/, { timeout: 20000 }).catch(() => {});
  check("member signs in", !page.url().includes("/signin"), page.url());

  // ---------- Responsible play controls ----------
  const profile = await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  check("/profile renders", profile.status() === 200, String(profile.status()));
  const profileText = await page.textContent("body");
  check("/profile is not an error page", !/Application error|Internal Server Error/i.test(profileText));
  check("limits panel is on the page", /Your limits/i.test(profileText));
  check("daily stake cap control present", (await page.locator('[name="dailyStakeLimit"]').count()) > 0);
  check("take-a-break control present", (await page.locator('[name="excludeDays"]').count()) > 0);
  check(
    "break is described as extend-only",
    /extended, not shortened/i.test(profileText) || /No break/i.test(profileText)
  );
  // A balance nobody can audit is just a number the house asserts.
  check("credit statement is on the page", /Credit statement/i.test(profileText));
  check("statement shows the seeded movement", /e2e seed|e2e-seed/i.test(profileText));
  check("statement states credits are not cash", /never pay out as cash/i.test(profileText));
  await page.screenshot({ path: `${SHOTS}/money-profile-limits.png`, fullPage: false });

  // ---------- Market, both floors ----------
  for (const path of ["/market", "/market?side=CUSTOM", "/predict"]) {
    const r = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const t = await page.textContent("body");
    check(`${path} renders`, r.status() === 200, String(r.status()));
    check(`${path} is not an error page`, !/Application error|Internal Server Error/i.test(t));
  }

  // ---------- The trade panel, on a symbol that actually has a price ----------
  const shoe = await prisma.catalogShoe.findFirst({
    where: { OR: [{ marketPriceCents: { gt: 0 } }, { ebayNewCents: { gt: 0 } }] },
    select: { sku: true },
  });
  if (shoe) {
    const r = await page.goto(`${BASE}/market?sym=${encodeURIComponent(shoe.sku)}`, {
      waitUntil: "networkidle",
    });
    const t = await page.textContent("body");
    check(`trade panel renders on ${shoe.sku}`, r.status() === 200, String(r.status()));
    check("trade panel is not an error page", !/Application error|Internal Server Error/i.test(t));
    check("ticket offers a stake", /Stake/i.test(t));
    // The line that keeps this a game. If it ever stops rendering, the
    // product has quietly changed into something else.
    check("ticket states credits are not cash", /never pay out as cash/i.test(t));
    await page.screenshot({ path: `${SHOTS}/money-trade-panel.png`, fullPage: false });
  } else {
    check("a priced symbol exists to open the panel on", false, "no priced catalog shoe");
  }

  // ---------- The market explains itself ----------
  // A pair with both legs quoted, so the spread lesson has real numbers to
  // work with rather than falling back to the concept alone.
  const quoted = await prisma.catalogShoe.findFirst({
    where: { ebayUsedCents: { gt: 0 }, ebayNewCents: { gt: 0 } },
    select: { sku: true, ebayUsedCents: true, ebayNewCents: true },
  });
  if (quoted) {
    await page.goto(`${BASE}/market?sym=${encodeURIComponent(quoted.sku)}`, { waitUntil: "networkidle" });
    const triggers = await page.getByRole("button", { name: /What does .* mean\?/ }).count();
    check("lessons are attached to the market numbers", triggers >= 5, `${triggers} found`);

    await page.getByRole("button", { name: /What does Spread mean\?/ }).first().click();
    const sheet = page.getByRole("dialog");
    await sheet.waitFor({ timeout: 5000 });
    const text = (await sheet.textContent()).replace(/\s+/g, " ");
    check("lesson names the concept", /bid-ask spread/i.test(text));
    check("lesson gives the street term", /cost of being in a hurry/i.test(text));

    // The whole point: it explains using this pair's real figures.
    const bid = `$${Math.round(quoted.ebayUsedCents / 100).toLocaleString("en-US")}`;
    const ask = `$${Math.round(quoted.ebayNewCents / 100).toLocaleString("en-US")}`;
    check("lesson quotes this pair's real bid", text.includes(bid), bid);
    check("lesson quotes this pair's real ask", text.includes(ask), ask);

    // The scrim must darken. --color-ink flips to white in light mode, so
    // an ink-based scrim silently stops dimming anything.
    const scrimBg = await sheet.locator("xpath=..").evaluate((el) => getComputedStyle(el).backgroundColor);
    const rgb = scrimBg.match(/\d+/g)?.map(Number) ?? [];
    check("scrim is dark, not a white wash", rgb[0] < 60 && rgb[1] < 60 && rgb[2] < 60, scrimBg);

    // Portalled out of the .tag ancestry, so prose reads as prose.
    const transform = await sheet.evaluate((el) => getComputedStyle(el).textTransform);
    check("lesson prose is not uppercased by inheritance", transform === "none", transform);

    // Capture it open — a screenshot of the closed page proves nothing.
    await page.screenshot({ path: `${SHOTS}/money-lesson-sheet.png` });
    await page.keyboard.press("Escape");
    check("Escape closes the lesson", (await sheet.count()) === 0);
  } else {
    check("a two-sided quote exists to teach the spread on", false, "no shoe with both legs");
  }

  check("no console or page errors anywhere", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  await prisma.creditTransaction.deleteMany({ where: { userId: member.id } });
  await prisma.user.delete({ where: { id: member.id } }).catch(() => {});
  await prisma.$disconnect();
}

console.log("\n=== MONEY SURFACES SUITE ===");
for (const r of results) console.log(r);
