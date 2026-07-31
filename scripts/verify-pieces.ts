/**
 * A piece's own history: when it was commissioned, when it dropped.
 *
 * The date maths is where this goes wrong quietly. A bare YYYY-MM-DD
 * parsed as midnight UTC lands on the PREVIOUS day for everybody west
 * of Greenwich, which is most of this platform's makers, and the bug
 * looks like "the calendar is off by one" months after anybody
 * remembers why.
 *
 * Run: npm run verify:pieces   (pure logic + source wiring, no database)
 */
import { readFileSync } from "fs";
import { join } from "path";
import { formatPieceDate, isUpcoming, parsePieceDates } from "../lib/pieceDates";

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

function main() {
  const NOW = Date.parse("2026-07-31T00:00:00Z");

  // ---- Parsing -----------------------------------------------------------
  const empty = parsePieceDates("", "", NOW);
  check(
    "both dates blank is fine, not an error",
    empty.ok && empty.dates.commissionedAt === null && empty.dates.releasedAt === null,
    "nobody is blocked from posting because they can't remember a date"
  );

  const one = parsePieceDates("", "2024-03-15", NOW);
  check("a release date alone parses", one.ok && one.dates.releasedAt !== null);

  const noon = parsePieceDates("", "2024-03-15", NOW);
  check(
    "a date lands at noon UTC, not midnight",
    noon.ok && noon.dates.releasedAt!.toISOString() === "2024-03-15T12:00:00.000Z",
    "midnight puts the day before on the calendar for everyone west of Greenwich"
  );
  check(
    "and it still reads as the day the maker typed",
    noon.ok && formatPieceDate(noon.dates.releasedAt!) === "Mar 15, 2024"
  );

  check("garbage in the commission field is rejected", !parsePieceDates("not-a-date", "", NOW).ok);
  check("garbage in the release field is rejected", !parsePieceDates("", "13/45/2024", NOW).ok);

  // ---- The ordering rule -------------------------------------------------
  const backwards = parsePieceDates("2024-06-01", "2024-01-01", NOW);
  check(
    "a release before its own commission is refused",
    !backwards.ok,
    "far more often a slip of filling two fields in the wrong order than a lie"
  );
  check(
    "and the error says what to do about it",
    !backwards.ok && /swap them/i.test(backwards.error)
  );
  check(
    "same-day commission and release is allowed",
    parsePieceDates("2024-06-01", "2024-06-01", NOW).ok,
    "quick turnarounds are real"
  );

  // ---- Sanity bounds -----------------------------------------------------
  check("a year typo before 1970 is caught", !parsePieceDates("", "0224-03-15", NOW).ok);
  check(
    "a release more than two years out is caught",
    !parsePieceDates("", "2030-01-01", NOW).ok,
    "announcing four years ahead is a typo, not a plan"
  );
  check(
    "but a genuine near-future announcement is allowed",
    parsePieceDates("", "2026-11-20", NOW).ok
  );

  // ---- Upcoming vs released ----------------------------------------------
  check("a future release reads as upcoming", isUpcoming(new Date(NOW + 86_400_000), NOW));
  check("a past release does not", !isUpcoming(new Date(NOW - 86_400_000), NOW));
  check("no date is not upcoming", !isUpcoming(null, NOW));

  // ---- Wiring ------------------------------------------------------------
  const actions = readFileSync(join(process.cwd(), "app", "actions.ts"), "utf8");
  check(
    "the upload path parses the dates",
    /parsePieceDates\(\s*\n?\s*String\(formData\.get\("commissionedAt"/.test(actions),
    "a field on the form that no action reads is a lie to the maker"
  );
  check(
    "both write paths persist them",
    (actions.match(/commissionedAt: dates\.dates\.commissionedAt/g) ?? []).length === 2,
    "upload and edit, or a maker can set a date once and never fix it"
  );
  check(
    "approving a piece refreshes the drop calendar",
    /revalidatePath\("\/drops"\);/.test(
      actions.slice(actions.indexOf("export async function setSubmissionStatus"))
    ),
    "the calendar only shows APPROVED pieces, so moderation moves them in and out of it"
  );

  const drops = readFileSync(join(process.cwd(), "app", "drops", "page.tsx"), "utf8");
  check(
    "the calendar reads pieces, not just announcements",
    /prisma\.submission\.findMany/.test(drops),
    "this is what puts a maker's back catalogue on the calendar at all"
  );
  check(
    "and only approved ones",
    /status: "APPROVED", releasedAt: \{ gte: monthStart/.test(drops),
    "an unreviewed piece must not reach a public calendar"
  );
  check(
    "a future piece is badged differently from a past one",
    /Upcoming custom/.test(drops) && /badge: p\.releasedAt\.getTime\(\) > now\.getTime\(\)/.test(drops)
  );

  const studio = readFileSync(join(process.cwd(), "app", "studio", "page.tsx"), "utf8");
  check(
    "the studio hands the date input a YYYY-MM-DD string",
    /toISOString\(\)\.slice\(0, 10\)/.test(studio),
    "localising it here would show the previous day in the field"
  );

  const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  check(
    "the calendar's monthly query has an index behind it",
    /@@index\(\[status, releasedAt\]\)/.test(schema)
  );
  check(
    "there is no separate unreleased flag to disagree with the date",
    !/isUnreleased|unreleased\s+Boolean/i.test(schema),
    "a flag and a date will drift, and then nobody knows which one is true"
  );

  console.log(log.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
