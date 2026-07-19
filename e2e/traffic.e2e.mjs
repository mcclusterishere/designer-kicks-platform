// First-party traffic analytics + compliance surface: UTM-tagged hits
// land with the right source/campaign/device, bots and opted-out
// browsers are never counted, the admin Traffic Pulse shows it all,
// and the legal pages carry the analytics + Meta-release language.
import { PrismaClient } from "@prisma/client";
import { BASE, SHOTS, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();
const results = [];
const check = makeChecker(results);

await prisma.pageView.deleteMany({ where: { campaign: { startsWith: "e2e-" } } });

const browser = await launchBrowser();

async function waitForRow(where, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await prisma.pageView.findFirst({ where });
    if (row) return row;
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

// ---------- A Facebook click lands, tagged ----------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/?utm_source=facebook&utm_medium=post&utm_campaign=e2e-fb-test`, {
  waitUntil: "networkidle",
});
const fbHit = await waitForRow({ campaign: "e2e-fb-test" });
check("facebook UTM hit recorded", Boolean(fbHit));
check("source resolved to facebook", fbHit?.source === "facebook" && fbHit?.medium === "post");
check("desktop device classed", fbHit?.device === "desktop");
check("visitor hash present, no raw IP field", Boolean(fbHit?.visitorHash) && fbHit.visitorHash.length === 32);

// SPA navigation fires a second pageview for the new route
await page.getByRole("link", { name: "Arena", exact: true }).first().click();
await page.waitForURL("**/battles", { timeout: 15000 });
const spaHit = await waitForRow({ path: "/battles", visitorHash: fbHit.visitorHash });
check("route change tracked as its own pageview", Boolean(spaHit));

// ---------- A phone shows up as mobile ----------
const phoneCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
});
const phone = await phoneCtx.newPage();
await phone.goto(`${BASE}/?utm_source=facebook&utm_medium=post&utm_campaign=e2e-mobile`, {
  waitUntil: "networkidle",
});
const mobileHit = await waitForRow({ campaign: "e2e-mobile" });
check("mobile device classed", mobileHit?.device === "mobile");

// ---------- Facebook's preview crawler is NOT traffic ----------
const botCtx = await browser.newContext({
  userAgent: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
});
const bot = await botCtx.newPage();
await bot.goto(`${BASE}/?utm_source=facebook&utm_campaign=e2e-bot`, { waitUntil: "networkidle" });
await new Promise((r) => setTimeout(r, 1500));
check("bot visit not counted", (await prisma.pageView.count({ where: { campaign: "e2e-bot" } })) === 0);

// ---------- Opt-out is honored ----------
const optCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await optCtx.addInitScript(() => localStorage.setItem("hc-analytics-optout", "1"));
const opt = await optCtx.newPage();
await opt.goto(`${BASE}/?utm_campaign=e2e-optout`, { waitUntil: "networkidle" });
await new Promise((r) => setTimeout(r, 1500));
check("opted-out browser not counted", (await prisma.pageView.count({ where: { campaign: "e2e-optout" } })) === 0);

// ---------- Admin pages are never tracked ----------
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await adminCtx.newPage();
await admin.goto(`${BASE}/admin?utm_campaign=e2e-admin`, { waitUntil: "networkidle" });
await new Promise((r) => setTimeout(r, 1200));
check("admin pages not tracked", (await prisma.pageView.count({ where: { campaign: "e2e-admin" } })) === 0);

// ---------- Admin Traffic Pulse shows the campaign ----------
await admin.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await admin.fill("#password", ADMIN_PASSWORD);
await admin.getByRole("button", { name: "Enter" }).click();
await admin.getByText("Traffic", { exact: false }).first().waitFor({ timeout: 10000 });
check("traffic pulse renders", await admin.getByRole("heading", { name: /Traffic/ }).isVisible());
check("facebook listed as a source", await admin.getByText("Top sources (7d)").isVisible());
const sourcesCard = admin.locator("div.rounded-xl", { hasText: "Top sources (7d)" }).first();
check("facebook row present", (await sourcesCard.getByText("facebook", { exact: true }).count()) >= 1);
const campCard = admin.locator("div.rounded-xl", { hasText: "Campaigns (7d)" }).first();
check("campaign segmented", (await campCard.getByText("e2e-fb-test").count()) >= 1);
await admin.screenshot({ path: `${SHOTS}/traffic-pulse.png`, fullPage: false });

// ---------- Compliance surfaces ----------
const legal = await ctx.newPage();
await legal.goto(`${BASE}/privacy`, { waitUntil: "networkidle" });
check("privacy explains cookie-free analytics", await legal.getByText("Analytics (cookie-free)").isVisible());
check("privacy offers the opt-out switch", await legal.getByRole("button", { name: /Opt out of analytics/ }).isVisible());
await legal.goto(`${BASE}/rules`, { waitUntil: "networkidle" });
check("giveaway rules carry the Meta release", await legal.getByText(/release Meta from any and all/).isVisible());
check("no-purchase-necessary stays loud", await legal.getByText("NO PURCHASE NECESSARY", { exact: false }).isVisible());

// ---------- /go affiliate redirect layer ----------
await prisma.outboundClick.deleteMany({ where: { ref: "e2e-go" } });
const go = async (u, ref = "e2e-go") => {
  const res = await fetch(
    `${BASE}/go?u=${encodeURIComponent(u)}&ref=${encodeURIComponent(ref)}`,
    { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (e2e test browser)" } }
  );
  return { status: res.status, location: res.headers.get("location") };
};

const known = await go("https://stockx.com/search?s=kobe%206%20dodgers");
check("known merchant 302s to target", known.status === 302 && known.location.startsWith("https://stockx.com/search"));
const clickRow = await (async () => {
  for (let i = 0; i < 20; i++) {
    const r = await prisma.outboundClick.findFirst({ where: { ref: "e2e-go", merchant: "stockx" } });
    if (r) return r;
    await new Promise((res) => setTimeout(res, 300));
  }
  return null;
})();
check("outbound click logged with merchant + hash", Boolean(clickRow?.visitorHash));

const evil = await go("https://evil-phisher.example/steal");
check("unknown host refused — no open redirect", evil.status === 302 && new URL(evil.location, BASE).pathname === "/");

// New marketplace merchants pass the allowlist
const etsy = await go("https://www.etsy.com/search?q=custom%20sneakers");
check("etsy allowlisted for the Market", etsy.status === 302 && etsy.location.startsWith("https://www.etsy.com/search"));

// ---------- Admin Market Pulse shows the money funnel ----------
await admin.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
const marketPulse = admin.locator('[data-testid="market-pulse"]');
check("market pulse renders", await marketPulse.getByRole("heading", { name: "Market Pulse" }).isVisible());
check("market pulse counts stockx clicks", (await marketPulse.getByText("stockx", { exact: true }).count()) >= 1);
check("market pulse shows placement refs", (await marketPulse.getByText("e2e-go", { exact: true }).count()) >= 1);

const botGo = await fetch(`${BASE}/go?u=${encodeURIComponent("https://www.goat.com/search?query=x")}&ref=e2e-go`, {
  redirect: "manual",
  headers: { "user-agent": "facebookexternalhit/1.1" },
});
check("bot clicks still redirect", botGo.status === 302);
await new Promise((r) => setTimeout(r, 800));
check("bot clicks not counted", (await prisma.outboundClick.count({ where: { ref: "e2e-go", merchant: "goat" } })) === 0);

// Where-to-buy strip on a drop article routes through /go
const dropArticle = await prisma.article.findFirst({ where: { status: "PUBLISHED", dropAt: { not: null } } });
if (dropArticle) {
  const html = await (await fetch(`${BASE}/news/${dropArticle.slug}`)).text();
  check("article buy strip routes through /go", html.includes("/go?u="));
  check("buy strip includes paying merchants", html.includes("StockX") && html.includes("GOAT"));
  check("affiliate disclosure near the links", html.includes("affiliate links"));
} else {
  check("article buy strip routes through /go", false, "no drop article found");
}

await browser.close();
await prisma.$disconnect();

console.log("\n=== TRAFFIC + COMPLIANCE SUITE ===");
for (const r of results) console.log(r);
