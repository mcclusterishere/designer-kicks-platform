import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { isAdmin } from "@/lib/admin";
import { consentUrl, youtubeOAuthConfigured } from "@/lib/youtube";

/**
 * Start the one-time YouTube connect.
 *
 * Admin-only, and carries a signed-ish state nonce in a cookie that the
 * callback must match — without it, anyone who found this URL could bounce
 * an admin through a consent screen and attach their own channel.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL("/admin", process.env.NEXT_PUBLIC_SITE_URL || "https://theheatchart.com"));
  }
  if (!youtubeOAuthConfigured()) {
    return NextResponse.json(
      { error: "Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET first." },
      { status: 400 }
    );
  }
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("yt_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(consentUrl(state));
}
