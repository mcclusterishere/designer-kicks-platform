import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyUnsubToken } from "@/lib/battleAlerts";

export const dynamic = "force-dynamic";

// One-click battle-alert unsubscribe from the email footer. HMAC-signed
// per-user link — no login, no stored token, can't be guessed for other
// users. Re-subscribe lives on the profile page.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!verifyUnsubToken(u, t)) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }
  await prisma.user
    .update({ where: { id: u }, data: { battleAlerts: false } })
    .catch(() => {});
  return new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
     <body style="font-family:system-ui;background:#0b0b0c;color:#e9e6df;display:grid;place-items:center;min-height:100vh;margin:0">
       <div style="text-align:center;padding:2rem">
         <h1 style="margin:0 0 .5rem">You're off battle alerts.</h1>
         <p style="color:#a8a59c">No more emails when battles start. Changed your mind? Flip it back on anytime in <a href="/profile" style="color:#f04e45">your profile</a>.</p>
       </div>
     </body>`,
    { headers: { "content-type": "text/html" } }
  );
}
