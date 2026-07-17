// Newsroom: listing, article SEO tags (meta/OG/canonical/JSON-LD),
// sitemap/robots/RSS, and the admin authoring flow.
import { PrismaClient } from "@prisma/client";
import { BASE, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

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
await page.check('input[name="publish"]');
await page.getByRole("button", { name: "Save Article" }).click();
await page.getByText("Saved.").waitFor({ timeout: 10000 });
check("admin can publish an article", true);

await page.goto(`${BASE}/news/${TEST_SLUG}`, { waitUntil: "networkidle" });
check("published article live at slug", await page.getByText("E2E News Suite Article").first().isVisible());
check("markdown bold renders", (await page.locator("article strong").count()) > 0);

// Cleanup
await prisma.article.deleteMany({ where: { slug: TEST_SLUG } });

await browser.close();
await prisma.$disconnect();
console.log(results.join("\n"));
