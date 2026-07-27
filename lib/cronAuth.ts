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
 * stay open for local runs — but NEVER in production. See below.
 */
export function cronAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const key = req.nextUrl.searchParams.get("key")?.trim() ?? "";

  return cronKeyAccepted({
    secret: process.env.CRON_SECRET,
    bearer,
    key,
    production: process.env.NODE_ENV === "production",
  });
}

/**
 * The decision itself, with nothing to mock.
 *
 * Split out from the request so it can be tested directly, and because
 * the interesting case has no request in it at all: what happens when the
 * secret is MISSING.
 *
 * This used to answer "let them in". That is the right default on a
 * laptop and the wrong one on the internet, and the gap between those two
 * is invisible — an empty CRON_SECRET looks exactly like a configured
 * one from the outside, right up until someone finds the URL. It is not
 * hypothetical: a `CRON_SECRET=""` line in a local .env parses to the
 * empty string, and that is precisely how these six endpoints were found
 * answering unauthenticated GETs during the pre-deploy audit.
 *
 * What is behind them is not trivial. They finalise battles (closing
 * votes on their own schedule), spend metered third-party API quota, and
 * send the weekly recap to every active member — so an open one is a
 * stranger's button for mailing your whole user list.
 *
 * So: fail open in development, fail CLOSED in production. A blank secret
 * in production now returns 401 for everyone including the real
 * scheduler, which is loud, fixable, and enormously preferable to quiet.
 */
export function cronKeyAccepted(input: {
  secret: string | undefined;
  bearer: string;
  key: string;
  production: boolean;
}): boolean {
  const { secret, bearer, key, production } = input;
  if (!secret) return !production;

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
