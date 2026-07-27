// The markets track: pick the desk, answer laddered questions, read the
// lesson, and watch Market IQ move independently of Culture IQ.
//
// The lesson assertion is the point of the whole feature. A markets
// question that reveals only "correct/wrong" is trivia wearing a suit.
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { BASE, SHOTS, makeChecker, launchBrowser } from "./helpers.mjs";

const prisma = new PrismaClient();
const results = [];
const check = makeChecker(results);

const EMAIL = `desk-e2e-${process.pid}@example.invalid`;
const PASS = "DeskSuite!2026";
const member = await prisma.user.create({
  data: { email: EMAIL, name: "Desk Suite", passwordHash: await hash(PASS, 10), pmaAcceptedAt: new Date() },
});

const browser = await launchBrowser();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

try {
  await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/profile/, { timeout: 20000 }).catch(() => {});
  check("member signs in", !page.url().includes("/signin"), page.url());

  // A fresh member is a Retail Buyer who hasn't started.
  const profileText = await page.textContent("body");
  check("profile shows Market IQ", /Market IQ/i.test(profileText));
  check("unstarted member isn't given a fake rank", /not started/i.test(profileText));

  // ---------- Two doors ----------
  await page.goto(`${BASE}/quiz`, { waitUntil: "networkidle" });
  const quizText = await page.textContent("body");
  check("quiz offers both tracks", /Culture IQ/.test(quizText) && /Market IQ/.test(quizText));
  await page.screenshot({ path: `${SHOTS}/desk-two-doors.png` });

  await page.getByRole("button", { name: /The Desk/ }).click();

  // ---------- Play, and read what it teaches ----------
  // Poll for the row rather than waiting on page text: the server action
  // commits on its own schedule, and a text match can resolve against
  // copy that was already on the page before the click.
  let run = null;
  for (let i = 0; i < 40 && !run; i++) {
    run = await prisma.quizRun.findFirst({
      where: { userId: member.id },
      orderBy: { startedAt: "desc" },
    });
    if (!run) await new Promise((r) => setTimeout(r, 500));
  }
  check("starting the desk creates a run", Boolean(run));
  if (!run) throw new Error("no run created — cannot continue");
  await page.getByRole("button", { name: /^A\s/ }).first().waitFor({ timeout: 15000 }).catch(() => {});
  check("run is stamped as a markets run", run?.track === "markets", String(run?.track));

  const ids = JSON.parse(run.questionIds);
  const served = await prisma.quizQuestion.findMany({
    where: { id: { in: ids } },
    select: { track: true, level: true },
  });
  check("every served question is a markets question",
    served.length > 0 && served.every((q) => q.track === "markets"),
    `${served.filter((q) => q.track !== "markets").length} strays`);
  // A brand-new player is level 1, so the ladder must not deal level 5.
  check("the ladder holds a new player at level 1",
    served.every((q) => q.level === 1), JSON.stringify([...new Set(served.map((q) => q.level))]));

  // Answer the first question correctly, straight from the database.
  const first = await prisma.quizQuestion.findUnique({ where: { id: ids[0] } });
  const opts = JSON.parse(first.options);
  await page.getByRole("button", { name: opts[first.answerIndex], exact: false }).first().click();
  await page.getByText(/Correct\./).first().waitFor({ timeout: 15000 });
  const afterAnswer = await page.textContent("body");
  check("a right answer is confirmed", /Correct\./.test(afterAnswer));
  check("the lesson is shown, not just the score",
    afterAnswer.includes(first.lesson.slice(0, 60)), first.concept);
  check("the concept is named", new RegExp(first.concept.replace(/-/g, " "), "i").test(afterAnswer));
  // The page has to agree with the game being played.
  check("the page identifies itself as the desk", /The Desk/.test(afterAnswer));
  check("the in-run score is Market IQ, not Culture IQ", /MKT\s*\d/.test(afterAnswer));
  // Capture the reveal itself, scrolled to it, before moving on.
  await page.getByText(first.lesson.slice(0, 40)).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: `${SHOTS}/desk-lesson.png` });

  // ---------- The two scores move independently ----------
  const mk = await prisma.quizAnswer.count({
    where: { userId: member.id, correct: true, question: { track: "markets" } },
  });
  const cu = await prisma.quizAnswer.count({
    where: { userId: member.id, correct: true, question: { track: "culture" } },
  });
  check("the markets answer landed on the markets ledger", mk === 1, `markets ${mk}`);
  check("it did not land on the culture ledger", cu === 0, `culture ${cu}`);

  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  const after = await page.textContent("body");
  check("profile now shows a desk rank", /Retail Buyer/.test(after));
  check("profile shows the next rung", /to make Resale Trader/i.test(after));

  // ---------- The partnership ----------
  check("Street Credit Bureau is credited", /Street Credit Bureau/.test(after));
  // With no NEXT_PUBLIC_PARTNER_URL set, the card must credit without
  // linking — pointing people at a destination that isn't finished would
  // spend the credibility the card exists to build.
  const partnerLinks = await page.locator('a[href*="streetcredit"]').count();
  const configured = Boolean(process.env.NEXT_PUBLIC_PARTNER_URL);
  check(
    configured ? "partner card links out when configured" : "partner card credits without a dead link",
    configured ? partnerLinks > 0 : partnerLinks === 0,
    `links=${partnerLinks} configured=${configured}`
  );

  // ---------- The instrument rungs exist and are gated ----------
  const instrumentLevels = await prisma.quizQuestion.groupBy({
    by: ["level"],
    where: { track: "markets", level: { gte: 6 } },
    _count: true,
  });
  check("instrument rungs 6-8 are loaded",
    instrumentLevels.length === 3 && instrumentLevels.every((l) => l._count >= 5),
    JSON.stringify(instrumentLevels.map((l) => `${l.level}:${l._count}`)));

  check("no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  await prisma.quizAnswer.deleteMany({ where: { userId: member.id } });
  await prisma.quizRun.deleteMany({ where: { userId: member.id } });
  await prisma.creditTransaction.deleteMany({ where: { userId: member.id } });
  await prisma.user.delete({ where: { id: member.id } }).catch(() => {});
  await prisma.$disconnect();
}

console.log("\n=== DESK (MARKETS TRACK) SUITE ===");
for (const r of results) console.log(r);
