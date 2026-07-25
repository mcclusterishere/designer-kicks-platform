import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cronAuth";
import { refreshEverything } from "@/lib/refreshAll";

/**
 * Everything, one call. Instead of wiring five separate schedules, point a
 * single daily job here and the whole site keeps itself current:
 *
 *   https://theheatchart.com/api/cron/all?key=CRON_SECRET
 *
 * Add &mode=deep to sweep every catalog brand instead of the night's
 * rotation — that's the same pass the admin's "refresh everything" button
 * runs, and it's the slower one, so leave the nightly schedule on default.
 *
 * The steps themselves live in lib/refreshAll so the button and the schedule
 * can never drift into doing different amounts of work.
 *
 * Battle finalisation is time-sensitive (it closes votes on schedule), so
 * keep the dedicated /finalize job on its own short interval and let this
 * one carry the daily work.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const deep = req.nextUrl.searchParams.get("mode") === "deep";
  const report = await refreshEverything(deep ? "deep" : "nightly");
  return NextResponse.json(report);
}
