import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyRecaps } from "@/lib/weeklyRecap";

/**
 * The weekly personal recap send. Schedule ONCE a week on
 * cron-job.org (same bearer token as the other crons) — e.g. Sunday
 * evening. Each member gets their own week's numbers; anyone who did
 * nothing is skipped, and dormant accounts are never emailed.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://theheatchart.com/api/cron/weekly-recap
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, detail: "Dormant — set RESEND_API_KEY to send." });
  }
  const result = await sendWeeklyRecaps();
  return NextResponse.json({ ok: true, ...result });
}
