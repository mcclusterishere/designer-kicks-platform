import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

// The Feed, one page at a time. Personalizes when signed in.
export async function GET(req: NextRequest) {
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);
  const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 8));
  const session = await auth().catch(() => null);
  const feed = await getFeed(offset, limit, session?.user?.id ?? null);
  return NextResponse.json(
    { ...feed, signedIn: Boolean(session?.user?.id) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
