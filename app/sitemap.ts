import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/articles";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const [articles, battles, tournaments, artists, catalogShoes] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    }),
    prisma.battle.findMany({ select: { id: true, createdAt: true } }),
    prisma.tournament.findMany({ select: { slug: true, createdAt: true } }),
    prisma.artistProfile.findMany({ select: { slug: true, createdAt: true } }),
    // The SEO asset: every cataloged shoe is its own indexable page.
    prisma.catalogShoe.findMany({
      where: { imageUrl: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 2000,
      select: { sku: true, updatedAt: true },
    }),
  ]);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/news`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/battles`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/heat-list`, changeFrequency: "daily", priority: 0.8 },
    // The catalog index is a redirect into /market now, so it's left out —
    // a sitemap should list destinations, not hops. Per-shoe /catalog/[sku]
    // pages are still listed below; those are the real indexable assets.
    { url: `${base}/submit`, changeFrequency: "monthly", priority: 0.6 },
    // The hubs whose leaves were already listed. Submitting /artists/[slug]
    // and /news/[slug] while omitting /artists and /news told Google about
    // the branches and hid the trunk.
    { url: `${base}/artists`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/tournaments`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/available`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/rate`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/quiz`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/giveaway`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/sell`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/story`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/careers`, changeFrequency: "monthly", priority: 0.4 },
    // Legal and trust pages: low priority, but they should be indexable —
    // people search for them by name before trusting a platform.
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/rules`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/security`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/games`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/league`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/market`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/drops`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/drafted`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/games/guess-the-resale`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/games/higher-or-lower`, changeFrequency: "weekly", priority: 0.6 },
    ...articles.map((a) => ({
      url: `${base}/news/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...battles.map((b) => ({
      url: `${base}/battles/${b.id}`,
      lastModified: b.createdAt,
      changeFrequency: "hourly" as const,
      priority: 0.6,
    })),
    ...tournaments.map((t) => ({
      url: `${base}/tournaments/${t.slug}`,
      lastModified: t.createdAt,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    ...artists.map((a) => ({
      url: `${base}/artists/${a.slug}`,
      lastModified: a.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...catalogShoes.map((s) => ({
      url: `${base}/catalog/${encodeURIComponent(s.sku)}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
