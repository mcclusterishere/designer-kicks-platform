// The Feed + Broadcast: the algorithm serves a mixed, paged stream on
// the home page, infinite scroll pulls the next page, and the admin
// Broadcast composer posts into the feed (pinned to the top) with
// per-channel status + paste-ready copy when socials are unconnected.
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { BASE, SHOTS, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const results = [];
const check = makeChecker(results);
const POST_BODY = "E2E broadcast: Fit Check Friday goes live at noon.";
const ARTIST_POST = "E2E artist post: new build on the bench, reveal Friday.";
const ARTIST_EMAIL = "feed-artist@test.example";
const FAN_EMAIL = "feed-fan@test.example";

// Cleanup from prior runs
await prisma.feedPost.deleteMany({ where: { body: { startsWith: "E2E " } } });
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
// No Meta tokens locally → both socials report not connected + copy fallback
check("facebook shows not connected", await admin.getByText("Facebook: not connected").isVisible());
check("instagram shows not connected", await admin.getByText("Instagram: not connected").isVisible());
const copyBox = admin.locator("textarea[readonly]");
check("paste-ready copy offered", (await copyBox.inputValue()).includes(POST_BODY));
const saved = await prisma.feedPost.findFirst({ where: { body: POST_BODY } });
check("feed post stored pinned with link", saved?.pinned === true && saved?.linkUrl === "/battles");
await admin.screenshot({ path: `${SHOTS}/feed-broadcast.png`, fullPage: false });

// ---------- The home page scroll machine ----------
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.locator("[data-testid=feed-item]").first().waitFor({ timeout: 15000 });
check(
  "pinned broadcast leads the feed",
  (await page.locator("[data-testid=feed-item]").first().innerText()).includes(POST_BODY)
);
const before = await page.locator("[data-testid=feed-item]").count();
await page.locator("[data-testid=feed-list]").scrollIntoViewIfNeeded();
// Scroll to the bottom repeatedly until the next page arrives.
for (let i = 0; i < 10; i++) {
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(400);
  if ((await page.locator("[data-testid=feed-item]").count()) > before) break;
}
const after = await page.locator("[data-testid=feed-item]").count();
check("infinite scroll loads the next page", after > before);
await page.screenshot({ path: `${SHOTS}/feed-home.png`, fullPage: false });

// ---------- Admin can delete a post ----------
await admin.reload({ waitUntil: "networkidle" });
const row = admin.locator("div.rounded-lg", { hasText: POST_BODY }).first();
await row.getByRole("button", { name: /Delete post/ }).click();
await admin.waitForTimeout(1500);
check(
  "delete removes the post",
  (await prisma.feedPost.count({ where: { body: POST_BODY } })) === 0
);

// ---------- An artist posts from their Studio ----------
const artistUser = await prisma.user.create({
  data: {
    name: "Feed Artist",
    email: ARTIST_EMAIL,
    passwordHash: await hash("feedpass99", 10),
    artistProfile: {
      create: { slug: "e2e-feed-artist", displayName: "Feed Artist", status: "APPROVED" },
    },
  },
});
const artistPage = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await artistPage.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
await artistPage.fill("#email", ARTIST_EMAIL);
await artistPage.fill("#password", "feedpass99");
await artistPage.getByRole("button", { name: "Sign In", exact: true }).click();
await artistPage.waitForURL("**/profile", { timeout: 15000 });
await artistPage.goto(`${BASE}/studio`, { waitUntil: "networkidle" });
await artistPage.getByRole("heading", { name: "Your Mic" }).waitFor({ timeout: 10000 });
check("artist sees Your Mic in the studio", true);
await artistPage.fill("#sp-body", ARTIST_POST);
await artistPage.getByRole("button", { name: "Post", exact: true }).click();
await artistPage.getByText("live in The Feed").waitFor({ timeout: 15000 });
const artistPost = await prisma.feedPost.findFirst({
  where: { body: ARTIST_POST },
  include: { artist: true },
});
check("artist post stored with the artist byline", artistPost?.artist?.slug === "e2e-feed-artist");

// ---------- A fan reacts and talks ----------
await prisma.user.create({
  data: { name: "Feed Fan", email: FAN_EMAIL, passwordHash: await hash("fanpass99", 10) },
});
const fan = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await fan.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
await fan.fill("#email", FAN_EMAIL);
await fan.fill("#password", "fanpass99");
await fan.getByRole("button", { name: "Sign In", exact: true }).click();
await fan.waitForURL("**/profile", { timeout: 15000 });
await fan.goto(BASE, { waitUntil: "networkidle" });
const artistCard = fan.locator("[data-testid=feed-item]", { hasText: ARTIST_POST }).first();
await artistCard.waitFor({ timeout: 15000 });
check(
  "artist byline links their page",
  (await artistCard.locator("a[href='/artists/e2e-feed-artist']").count()) >= 1
);
await artistCard.locator("[data-testid=feed-react]").click();
await fan.waitForTimeout(1200);
check(
  "fan flame stored",
  (await prisma.feedReaction.count({ where: { postId: artistPost.id } })) === 1
);
await artistCard.locator("[data-testid=feed-talk]").click();
await artistCard.getByPlaceholder("Say something…").fill("This one is a problem 🔥");
await artistCard.getByRole("button", { name: "post" }).click();
await fan.waitForTimeout(1200);
const comment = await prisma.feedComment.findFirst({ where: { postId: artistPost.id } });
check("fan comment stored", comment?.body === "This one is a problem 🔥");
check("comment renders in the card", await artistCard.getByText("This one is a problem").isVisible());
await fan.screenshot({ path: `${SHOTS}/feed-social.png`, fullPage: false });

// Cleanup
await prisma.feedPost.deleteMany({ where: { body: { startsWith: "E2E " } } });
await prisma.artistProfile.deleteMany({ where: { slug: "e2e-feed-artist" } });
await prisma.user.deleteMany({ where: { email: { in: [ARTIST_EMAIL, FAN_EMAIL] } } });

await browser.close();
await prisma.$disconnect();

console.log("\n=== FEED + BROADCAST SUITE ===");
for (const r of results) console.log(r);
