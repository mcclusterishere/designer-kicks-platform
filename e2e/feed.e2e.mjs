// The Feed + Broadcast + the game loop: the algorithm serves a mixed,
// paged stream on the home page; the admin broadcasts (pinned) with
// per-channel status; fans react/talk on posts, rate pieces inline,
// and answer culture questions that build a Culture IQ; approved
// artists Call Out a piece with their own closest-heat pair, spinning
// up a live battle.
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { BASE, SHOTS, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const results = [];
const check = makeChecker(results);
const POST_BODY = "E2E broadcast: Fit Check Friday goes live at noon.";
const ARTIST_EMAIL = "feed-artist@test.example";
const FAN_EMAIL = "feed-fan@test.example";

// Cleanup from prior runs
await prisma.battle.deleteMany({ where: { title: "Called Out" } });
await prisma.feedPost.deleteMany({ where: { body: { startsWith: "E2E " } } });
await prisma.submission.deleteMany({ where: { title: "E2E Callout Piece" } });
await prisma.artistProfile.deleteMany({ where: { slug: "e2e-feed-artist" } });
await prisma.user.deleteMany({ where: { email: { in: [ARTIST_EMAIL, FAN_EMAIL] } } });

// ---------- The API serves a ranked, paged stream ----------
const page1 = await (await fetch(`${BASE}/api/feed?offset=0&limit=8`)).json();
check("feed api serves items", Array.isArray(page1.items) && page1.items.length === 8);
check("feed api pages with nextOffset", page1.nextOffset === 8);
const page2 = await (await fetch(`${BASE}/api/feed?offset=8&limit=8`)).json();
const ids = (arr) => arr.map((i) => `${i.type}:${i.id ?? i.slug}`);
check(
  "page 2 never repeats page 1",
  page2.items.length > 0 && !ids(page2.items).some((id) => ids(page1.items).includes(id))
);
const types = new Set(page1.items.map((i) => i.type));
check("first page mixes content types", types.size >= 3);
const runs = page1.items.some(
  (item, i, arr) => i >= 2 && item.type === arr[i - 1].type && item.type === arr[i - 2].type
);
check("diversity pass breaks up runs of one type", !runs);

// ---------- Admin broadcasts a pinned post ----------
const browser = await launchBrowser();
const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await admin.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await admin.fill("#password", ADMIN_PASSWORD);
await admin.getByRole("button", { name: "Enter" }).click();
await admin.getByRole("heading", { name: "Broadcast" }).waitFor({ timeout: 10000 });
check("admin sees the Broadcast composer", true);

await admin.fill("#bc-body", POST_BODY);
await admin.fill("#bc-link", "/battles");
await admin.fill("#bc-label", "Into the arena");
await admin.check('input[name="pinned"]');
await admin.getByRole("button", { name: "Broadcast", exact: true }).click();
await admin.getByText("Feed: posted ✓").waitFor({ timeout: 15000 });
check("post lands in the feed", true);
check("facebook shows not connected", await admin.getByText("Facebook: not connected").isVisible());
check("instagram shows not connected", await admin.getByText("Instagram: not connected").isVisible());
const copyBox = admin.locator("textarea[readonly]");
check("paste-ready copy offered", (await copyBox.inputValue()).includes(POST_BODY));
const saved = await prisma.feedPost.findFirst({ where: { body: POST_BODY } });
check("feed post stored pinned with link", saved?.pinned === true && saved?.linkUrl === "/battles");

// ---------- The home page scroll machine (signed out) ----------
const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await guest.goto(BASE, { waitUntil: "networkidle" });
await guest.locator("[data-testid=feed-item]").first().waitFor({ timeout: 15000 });
check(
  "pinned broadcast leads the feed",
  (await guest.locator("[data-testid=feed-item]").first().innerText()).includes(POST_BODY)
);
const before = await guest.locator("[data-testid=feed-item]").count();
await guest.locator("[data-testid=feed-list]").scrollIntoViewIfNeeded();
for (let i = 0; i < 10; i++) {
  await guest.mouse.wheel(0, 4000);
  await guest.waitForTimeout(400);
  if ((await guest.locator("[data-testid=feed-item]").count()) > before) break;
}
check("infinite scroll loads the next page", (await guest.locator("[data-testid=feed-item]").count()) > before);

// ---------- A fan plays the feed: react, talk, rate, answer ----------
const fanUser = await prisma.user.create({
  data: { name: "Feed Fan", email: FAN_EMAIL, passwordHash: await hash("fanpass99", 10) },
});
const fan = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await fan.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
await fan.fill("#email", FAN_EMAIL);
await fan.fill("#password", "fanpass99");
await fan.getByRole("button", { name: "Sign In", exact: true }).click();
await fan.waitForURL("**/profile", { timeout: 15000 });
await fan.goto(BASE, { waitUntil: "networkidle" });

const adminCard = fan.locator("[data-testid=feed-item]", { hasText: POST_BODY }).first();
await adminCard.waitFor({ timeout: 15000 });
await adminCard.locator("[data-testid=feed-react]").click();
await fan.waitForTimeout(1200);
check(
  "fan flame stored",
  (await prisma.feedReaction.count({ where: { postId: saved.id } })) === 1
);
await adminCard.locator("[data-testid=feed-talk]").click();
await adminCard.getByPlaceholder("Say something…").fill("Locked in for Friday");
await adminCard.getByRole("button", { name: "post" }).click();
await fan.waitForTimeout(1200);
check(
  "fan comment stored",
  (await prisma.feedComment.count({ where: { postId: saved.id } })) === 1
);

// Rate a piece inline — the feed IS the Rate game
async function findInFeed(page, selector) {
  for (let i = 0; i < 14; i++) {
    if ((await page.locator(selector).count()) > 0) return true;
    await page.mouse.wheel(0, 4200);
    await page.waitForTimeout(450);
  }
  return (await page.locator(selector).count()) > 0;
}
check("unrated piece deals the flame booth", await findInFeed(fan, "[data-testid=feed-rate]"));
// (The booth swaps to the verdict once rated, so wait on the verdict
// globally — the has: filter would re-resolve to a different card.)
await fan.getByRole("button", { name: "4 flames" }).first().click();
await fan.locator("[data-testid=feed-rate-verdict]").first().waitFor({ timeout: 10000 });
check("inline rating reveals the culture's verdict", true);
check(
  "inline rating stored",
  (await prisma.designRating.count({ where: { userId: fanUser.id, stars: 4 } })) === 1
);

// Answer a culture question — one shot, IQ moves
check("culture question floats in the feed", await findInFeed(fan, "[data-feed-type=question]"));
const qCard = fan.locator("[data-feed-type=question]").first();
await qCard.locator("[data-testid=feed-question-option]").first().click();
await qCard.locator("[data-testid=feed-iq]").waitFor({ timeout: 10000 });
check("answer reveals the Culture IQ", true);
const answerRow = await prisma.quizAnswer.findFirst({ where: { userId: fanUser.id } });
check("answer ledgered one-shot", Boolean(answerRow));
await fan.screenshot({ path: `${SHOTS}/feed-gameloop.png`, fullPage: false });

// Vote in a community poll — one vote per fan, live split revealed
check("community poll floats in the feed", await findInFeed(fan, "[data-feed-type=poll]"));
const pollCard = fan.locator("[data-feed-type=poll]").first();
await pollCard.locator("[data-testid=feed-poll-option]").first().click();
await pollCard.locator("[data-testid=feed-poll-result]").first().waitFor({ timeout: 10000 });
check("poll vote reveals the live community split", true);
check(
  "poll vote stored one-per-fan",
  (await prisma.pollVote.count({ where: { userId: fanUser.id } })) === 1
);

// The IQ panel on the profile
await fan.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await fan.locator("[data-testid=culture-iq]").waitFor({ timeout: 10000 });
const iqShown = Number(await fan.locator("[data-testid=culture-iq]").innerText());
check(
  "profile IQ matches the ledger",
  iqShown === (answerRow.correct ? 102 : 97)
);
if (!answerRow.correct) {
  check("repair shop lists the miss", await fan.getByText("The repair shop", { exact: false }).isVisible());
}

// ---------- An artist calls out a piece from the feed ----------
const artistUser = await prisma.user.create({
  data: {
    name: "Feed Artist",
    email: ARTIST_EMAIL,
    passwordHash: await hash("feedpass99", 10),
    artistProfile: {
      create: {
        slug: "e2e-feed-artist",
        displayName: "Feed Artist",
        status: "APPROVED",
        submissions: {
          create: {
            title: "E2E Callout Piece",
            artistName: "Feed Artist",
            email: ARTIST_EMAIL,
            baseShoe: "Nike Air Force 1",
            category: "sneakers",
            imageUrl: "/seed/ge-bp-2.webp",
            status: "APPROVED",
          },
        },
      },
    },
  },
});
const artist = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await artist.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
await artist.fill("#email", ARTIST_EMAIL);
await artist.fill("#password", "feedpass99");
await artist.getByRole("button", { name: "Sign In", exact: true }).click();
await artist.waitForURL("**/profile", { timeout: 15000 });
await artist.goto(BASE, { waitUntil: "networkidle" });

check("call out offered on rivals' pieces", await findInFeed(artist, "[data-testid=feed-callout]"));
await artist.locator("[data-testid=feed-callout]").first().click();
await artist.getByText("Pick your fighter", { exact: false }).waitFor({ timeout: 10000 });
await artist.getByRole("button", { name: /E2E Callout Piece/ }).click();
await artist.locator("[data-testid=feed-callout-sent]").waitFor({ timeout: 15000 });
check("call out spins up a live battle", true);
const battle = await prisma.battle.findFirst({ where: { title: "Called Out", status: "ACTIVE" } });
check("battle stored with the challenger's piece", Boolean(battle));
await artist.screenshot({ path: `${SHOTS}/feed-callout.png`, fullPage: false });

// ---------- Admin can still delete any post ----------
await admin.reload({ waitUntil: "networkidle" });
const row = admin.locator("div.rounded-lg", { hasText: POST_BODY }).first();
await row.getByRole("button", { name: /Delete post/ }).click();
await admin.waitForTimeout(1500);
check(
  "delete removes the post",
  (await prisma.feedPost.count({ where: { body: POST_BODY } })) === 0
);

// Cleanup
await prisma.battle.deleteMany({ where: { title: "Called Out" } });
await prisma.feedPost.deleteMany({ where: { body: { startsWith: "E2E " } } });
await prisma.submission.deleteMany({ where: { title: "E2E Callout Piece" } });
await prisma.artistProfile.deleteMany({ where: { slug: "e2e-feed-artist" } });
await prisma.user.deleteMany({ where: { email: { in: [ARTIST_EMAIL, FAN_EMAIL] } } });

await browser.close();
await prisma.$disconnect();

console.log("\n=== FEED + GAME LOOP SUITE ===");
for (const r of results) console.log(r);
