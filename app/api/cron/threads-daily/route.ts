import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cronAuth";
import { postToThreads, todaysPost, threadsReady, programDay } from "@/lib/threads";

/**
 * The daily Threads recruitment post. Schedule ONCE per day on
 * cron-job.org (same bearer token as the other crons) — each firing
 * publishes today's rotation entry with the escalating Day N count.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://theheatchart.com/api/cron/threads-daily
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await threadsReady())) {
    return NextResponse.json({
      ok: false,
      detail:
        "Dormant — either connect Threads in Social HQ, or set THREADS_USER_ID + THREADS_ACCESS_TOKEN.",
    });
  }
  const text = todaysPost();
  const result = await postToThreads(text);
  return NextResponse.json({ ...result, day: programDay(), text });
}
