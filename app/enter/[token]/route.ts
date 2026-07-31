import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * The ticket link from the DM. Whoever opens it is (almost certainly)
 * the person who commented — page-scoped Facebook ids can't be joined
 * to site accounts any other way without App Review, so this click IS
 * the join. The token rides a cookie to signup; registerUser stamps
 * the vote with the new userId, and their Facebook voting history
 * becomes part of their taste profile.
 *
 * An unknown token still lands on the giveaway page: the link's job is
 * getting them in the door, and a stale token shouldn't cost a signup.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const url = new URL("/giveaway?src=fb-ticket", req.nextUrl.origin);
  const res = NextResponse.redirect(url);
  const vote = await prisma.socialVote
    .findUnique({ where: { claimToken: token }, select: { id: true } })
    .catch(() => null);
  if (vote) {
    res.cookies.set("voteClaim", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
  }
  return res;
}
