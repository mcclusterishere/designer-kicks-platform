import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeCode, isConnectProvider, storeConnections } from "@/lib/metaConnect";

/**
 * Step two: Meta sent the user back with ?code= (or ?error= if they
 * bailed). Trade the code for long-lived tokens, hang the channel(s)
 * on the signed-in user, land them back on their desk with a status
 * flag the channels card can read.
 *
 * Every failure lands the user somewhere with words, never on raw
 * JSON — this URL only ever has a human on the other end.
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
  const url = new URL(req.url);
  const back = (flag: string) => {
    const res = NextResponse.redirect(new URL(`/editor?connected=${flag}`, req.url));
    res.cookies.delete(`dk_connect_${provider}`);
    return res;
  };

  if (!session?.user?.id) return NextResponse.redirect(new URL("/signin", req.url));
  if (url.searchParams.get("error")) return back("declined");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get(`dk_connect_${provider}`)?.value;
  // No nonce match, no connection. This is what stops a hostile page
  // from splicing an attacker's account grant onto our user's session.
  if (!code || !state || !cookieState || state !== cookieState) return back("failed");

  try {
    const accounts = await exchangeCode(provider, code);
    if (accounts.length === 0) {
      // A Facebook grant with zero Pages is the common real-world case:
      // they have a profile but never made a Page. Say so.
      return back(provider === "facebook_page" ? "no-pages" : "failed");
    }
    await storeConnections(session.user.id, accounts);
    return back("ok");
  } catch (e) {
    console.error(`[social-connect] ${provider} exchange failed:`, e);
    return back("failed");
  }
}
