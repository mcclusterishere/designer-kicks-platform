import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdmin } from "@/lib/admin";
import { exchangeCode } from "@/lib/youtube";

/**
 * Where Google sends the code back.
 *
 * Two gates: still an admin, and the state nonce matches the one we set on
 * the way out. A mismatch means this callback wasn't started by us.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://theheatchart.com";
  const back = (msg: string) => NextResponse.redirect(new URL(`/admin?tab=content&yt=${encodeURIComponent(msg)}`, base));

  if (!(await isAdmin())) return back("not signed in as admin");

  const jar = await cookies();
  const expected = jar.get("yt_oauth_state")?.value;
  const state = req.nextUrl.searchParams.get("state");
  if (!expected || !state || expected !== state) return back("state mismatch — start again from the admin panel");
  jar.delete("yt_oauth_state");

  const denied = req.nextUrl.searchParams.get("error");
  if (denied) return back(`Google said: ${denied}`);

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return back("no code returned");

  const res = await exchangeCode(code);
  return back(res.ok ? "YouTube connected" : res.detail);
}
