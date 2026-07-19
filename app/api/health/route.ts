import { NextResponse } from "next/server";

// Liveness probe for Railway's healthcheck. Deliberately does NO
// database work — if the DB is briefly slow under load, the health
// check must still pass so the platform doesn't kill and restart a
// healthy container into a crash loop.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
