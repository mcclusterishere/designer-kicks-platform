import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/articles";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const [articles, battles] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    }),
    prisma.battle.findMany({ select: { id: true, createdAt: true } }),
  ]);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/news`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/battles`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/heat-list`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/shop`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/submit`, changeFrequency: "monthly", priority: 0.6 },
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
  ];
}
