import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { finalizeExpiredBattles } from "@/lib/battles";

/**
 * Scheduled battle finalization. Pages already finalize lazily on view,
 * but a cron keeps results moving even with zero traffic (and posts
 * accurate data to anyone hitting the API/socials at odd hours).
 *
 * Vercel: vercel.json schedules this and sends CRON_SECRET as a bearer
 * token automatically when the env var is set. Other hosts: curl it
 * from any scheduler with the same header.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const before = await prisma.battle.count({ where: { status: "ACTIVE" } });
  await finalizeExpiredBattles(true); // scheduled run always executes, bypassing the lazy throttle
  const after = await prisma.battle.count({ where: { status: "ACTIVE" } });

  return NextResponse.json({ finalized: before - after, activeBattles: after });
}
