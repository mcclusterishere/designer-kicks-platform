import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Shared gate for the scheduled endpoints.
 *
 * Two ways to present CRON_SECRET, because the header-only version is the
 * single most common thing to get wrong in a scheduler's UI (a missing
 * "Bearer ", the value pasted into a basic-auth field, a header that
 * silently didn't save — all of which look identical from here: a 401):
 *
 *   1. Authorization: Bearer <secret>     ← preferred; keeps it out of logs
 *   2. ?key=<secret>                      ← paste-a-URL, no headers at all
 *
 * Both are checked in constant time. With no CRON_SECRET set the endpoints
 * stay open, which is the existing behaviour for local/dev runs.
 */
export function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset = unguarded, same as before

  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const key = req.nextUrl.searchParams.get("key")?.trim() ?? "";

  // A literal "+" in a query string decodes to a space. Secrets generated
  // with base64 often contain "+", and pasting one into a scheduler's URL
  // field without percent-encoding it silently corrupts the value — an
  // invisible cause of 401s. Compare the plus-restored form too so the
  // obvious paste just works.
  const plusRestored = key.includes(" ") ? key.replace(/ /g, "+") : "";

  return (
    safeEqual(bearer, secret) ||
    safeEqual(key, secret) ||
    (plusRestored !== "" && safeEqual(plusRestored, secret))
  );
}

function safeEqual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
