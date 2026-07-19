import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

// The Feed, one page at a time. Personalizes when signed in.
export async function GET(req: NextRequest) {
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);
  const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 8));
  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;
  const [feed, viewerArtist] = await Promise.all([
    getFeed(offset, limit, userId),
    userId
      ? prisma.artistProfile.findUnique({
          where: { userId },
          select: { slug: true, status: true },
        })
      : Promise.resolve(null),
  ]);
  return NextResponse.json(
    {
      ...feed,
      signedIn: Boolean(userId),
      // Approved artists see Call Out on other artists' pieces.
      viewerArtistSlug: viewerArtist?.status === "APPROVED" ? viewerArtist.slug : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
