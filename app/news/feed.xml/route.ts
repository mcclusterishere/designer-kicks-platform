import { getPublishedArticles, siteUrl } from "@/lib/articles";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const base = siteUrl();
  const articles = await getPublishedArticles(20);

  const items = articles
    .map(
      (a) => `    <item>
      <title>${esc(a.title)}</title>
      <link>${base}/news/${a.slug}</link>
      <guid isPermaLink="true">${base}/news/${a.slug}</guid>
      <description>${esc(a.excerpt)}</description>
      ${a.publishedAt ? `<pubDate>${a.publishedAt.toUTCString()}</pubDate>` : ""}
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Designer Kicks — Drop Report</title>
    <link>${base}/news</link>
    <description>Sneaker release dates, raffle intel, and drop news from Designer Kicks.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
