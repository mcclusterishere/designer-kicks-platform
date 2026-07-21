import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiResponse, apiOptions, paging } from "@/lib/publicApi";
import { siteUrl } from "@/lib/articles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { limit, offset } = paging(req);
  const [total, artists] = await Promise.all([
    prisma.artistProfile.count({ where: { status: "APPROVED" } }),
    prisma.artistProfile.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "asc" },
      skip: offset,
      take: limit,
      select: {
        slug: true,
        displayName: true,
        city: true,
        instagram: true,
        bio: true,
        createdAt: true,
        _count: { select: { submissions: { where: { status: "APPROVED" } } } },
      },
    }),
  ]);

  return apiResponse(req, {
    total,
    count: artists.length,
    offset,
    artists: artists.map((a) => ({
      slug: a.slug,
      name: a.displayName,
      city: a.city,
      instagram: a.instagram ? `@${a.instagram.replace(/^@/, "")}` : null,
      bio: a.bio,
      pieces: a._count.submissions,
      url: `${siteUrl()}/artists/${a.slug}`,
      joined: a.createdAt,
    })),
  });
}

export function OPTIONS() {
  return apiOptions();
}
