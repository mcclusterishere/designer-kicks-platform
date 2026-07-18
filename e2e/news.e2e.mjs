// Newsroom: listing, article SEO tags (meta/OG/canonical/JSON-LD),
// sitemap/robots/RSS, and the admin authoring flow.
import { PrismaClient } from "@prisma/client";
import { BASE, PNG_1x1, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const TEST_SLUG = "e2e-news-suite-article";
const results = [];
const check = makeChecker(results);

await prisma.article.deleteMany({ where: { slug: TEST_SLUG } });

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// --- News listing ---
await page.goto(`${BASE}/news`, { waitUntil: "networkidle" });
check("news listing renders", await page.getByText("Drop Report").first().isVisible());
check("seed articles listed", (await page.locator("a[href^='/news/']").count()) >= 3);

// --- Article page + SEO tags ---
const firstHref = await page.locator("a[href^='/news/']").first().getAttribute("href");
await page.goto(`${BASE}${firstHref}`, { waitUntil: "networkidle" });
const metaDesc = await page.locator('meta[name="description"]').getAttribute("content");
check("article has meta description", Boolean(metaDesc && metaDesc.length > 40));
check("article has OpenGraph tags", (await page.locator('meta[property="og:title"]').count()) > 0);
const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
check("article has canonical URL", Boolean(canonical?.includes("/news/")));
const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
check("article has NewsArticle JSON-LD", Boolean(jsonLd?.includes('"NewsArticle"')));
check("markdown renders (h2 present)", (await page.locator("article h2").count()) > 0);

// --- SEO infrastructure ---
const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
check("sitemap includes articles", sitemap.includes("/news/"));
const robots = await (await fetch(`${BASE}/robots.txt`)).text();
check("robots.txt blocks /admin, links sitemap", robots.includes("/admin") && robots.includes("sitemap.xml"));
const rss = await fetch(`${BASE}/news/feed.xml`);
const rssText = await rss.text();
check("RSS feed serves items", rss.headers.get("content-type")?.includes("rss") === true && rssText.includes("<item>"));

// --- Admin authoring flow ---
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.fill("#password", ADMIN_PASSWORD);
await page.getByRole("button", { name: "Enter" }).click();
await page.getByText("Newsroom").waitFor({ timeout: 10000 });

await page.fill("#a-title", "E2E News Suite Article");
await page.fill("#a-slug", TEST_SLUG);
await page.fill("#a-excerpt", "An end-to-end test article about a fake drop for testing purposes.");
await page.fill("#a-content", "## The drop\n\nThis is **test** content.\n\n- Date: soon\n- Price: $999");
await page.fill("#a-tags", "Test, E2E");
const dropDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
await page.fill("#a-drop", dropDate);
await page.fill("#a-raffle", "https://www.nike.com/launch");
// Real product photos enter through the upload field, not hotlinks
await page.setInputFiles("#a-cover-file", { name: "press.png", mimeType: "image/png", buffer: PNG_1x1 });
await page.check('input[name="publish"]');
await page.getByRole("button", { name: "Save Article" }).click();
await page.getByText("Saved.").waitFor({ timeout: 10000 });
check("admin can publish an article", true);

await page.goto(`${BASE}/news/${TEST_SLUG}`, { waitUntil: "networkidle" });
check("published article live at slug", await page.getByText("E2E News Suite Article").first().isVisible());
check("markdown bold renders", (await page.locator("article strong").count()) > 0);
const saved = await prisma.article.findUnique({ where: { slug: TEST_SLUG } });
check("uploaded cover photo stored and served", Boolean(saved?.coverImage) && (await fetch(`${BASE}${saved.coverImage}`)).ok);

// --- Free drop calendar ---
await page.goto(`${BASE}/drops`, { waitUntil: "networkidle" });
check("drop calendar renders free positioning", await page.getByText("Free forever").isVisible());
check("dated article on the calendar", await page.getByText("E2E News Suite Article").first().isVisible());
check("raffle link on the calendar", (await page.locator("a[href*='/go?u=https%3A%2F%2Fwww.nike.com']").count()) >= 1);
check("news page links the calendar", (await (await fetch(`${BASE}/news`)).text()).includes("/drops"));

// Cleanup
await prisma.article.deleteMany({ where: { slug: TEST_SLUG } });

await browser.close();
await prisma.$disconnect();
console.log(results.join("\n"));
