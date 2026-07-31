import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { authorizeUrl, connectConfigured, isConnectProvider } from "@/lib/metaConnect";

/**
 * Step one of "connect my Instagram / Threads / Facebook Page": stamp a
 * CSRF nonce into a cookie, send the signed-in user to Meta's consent
 * screen. The callback route checks the nonce on the way back.
 *
 * Sign-in required BEFORE redirecting, because the callback needs to
 * know which of our users this grant belongs to — an anonymous grant
 * belongs to nobody and would be dropped anyway.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params;
  if (!isConnectProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/signin?next=/editor", req.url));
  }
  // Staged rollout: admins test first; editors get it when the flag
  // flips. The UI already says "coming soon" — this backstop is for
  // anyone who bookmarks the URL itself.
  if (process.env.SOCIAL_CONNECT_LIVE !== "true") {
    const { isAdmin } = await import("@/lib/admin");
    if (!(await isAdmin())) {
      return NextResponse.redirect(new URL("/editor?connected=soon", req.url));
    }
  }
  if (!connectConfigured()[provider]) {
    return NextResponse.json(
      { error: "This channel isn't configured yet — the app credentials are missing." },
      { status: 503 }
    );
  }

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(provider, state));
  res.cookies.set(`dk_connect_${provider}`, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/social",
  });
  return res;
}
