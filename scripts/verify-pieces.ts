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

  // ---- Three photos, no video --------------------------------------------
  check(
    "the minimum is three, stated once and not exported from a use-server file",
    /\nconst MIN_PIECE_PHOTOS = 3;/.test(actions)
  );
  check(
    "the upload counts the cover toward the minimum",
    /if \(1 \+ extra\.length < MIN_PIECE_PHOTOS\)/.test(actions),
    "cover plus two, not cover plus three"
  );
  check(
    "and the refusal tells them what to shoot",
    /Show the sides, the sole, the detail/.test(actions),
    "a bare count is a rule; naming the angles is help"
  );
  check(
    "a piece upload cannot carry a video",
    (() => {
      const fn = actions.slice(actions.indexOf("export async function createSubmission"));
      const body = fn.slice(0, fn.indexOf("\n}\n"));
      return !/formData\.get\("video"\)/.test(body) && !/MAX_VIDEO_BYTES/.test(body);
    })(),
    "a clip in the same slot as the photos turned uploads into a video with two stills bolted on"
  );
  const submitForm = readFileSync(join(process.cwd(), "app", "submit", "SubmitForm.tsx"), "utf8");
  check(
    "the form offers no video field at all",
    !/name="video"/.test(submitForm) && !/accept="video/.test(submitForm),
    "leaving the input up and rejecting it server-side wastes their upload"
  );
  check(
    "the extra angles are required in the browser too",
    /name="morePhotos"[\s\S]{0,160}required/.test(submitForm),
    "so they find out before the upload, not after"
  );
  check(
    "the form says what the minimum is",
    /Three photos minimum/.test(submitForm)
  );

  // ---- The bars stay where they belong on iOS ----------------------------
  // backdrop-filter on a positioned element makes it establish its own
  // containing block AND, on iOS Safari, detach during momentum scroll
  // and repaint at a stale offset. That is the bug a user screenshotted:
  // the tab bar floating mid-page with content running underneath it.
  // The blur has to live on an inner layer, never on the positioned one.
  const tabBar = readFileSync(join(process.cwd(), "components", "MobileTabBar.tsx"), "utf8");
  const navTag = tabBar.slice(tabBar.indexOf("<nav"), tabBar.indexOf(">", tabBar.indexOf("<nav")));
  check(
    "the fixed tab bar carries no backdrop-filter itself",
    !/glass/.test(navTag) && /fixed inset-x-0 bottom-0/.test(navTag),
    "blur on the fixed element is what detaches it mid-scroll on iOS"
  );
  check("the blur moved to an inner layer", /className="glass border-t/.test(tabBar));
  check(
    "and the bar is promoted to its own compositing layer",
    /translateZ\(0\)/.test(tabBar)
  );
  check(
    "the safe-area padding rode along with the blur, not the position",
    /className="glass border-t[\s\S]{0,140}safe-area-inset-bottom/.test(tabBar),
    "otherwise the bar's backdrop stops short of the home indicator"
  );
  const layoutSrc = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
  const headerTag = layoutSrc.slice(
    layoutSrc.indexOf("<header"),
    layoutSrc.indexOf(">", layoutSrc.indexOf("<header"))
  );
  check(
    "the sticky header has the same split",
    !/glass/.test(headerTag) && /sticky top-0/.test(headerTag),
    "same iOS failure, same fix"
  );
  check(
    "content still clears the fixed bar on phones",
    /pb-24 md:pb-0/.test(layoutSrc),
    "without it the last card sits permanently under the tab bar"
  );

  // ---- The rename --------------------------------------------------------
  const giveaway = readFileSync(join(process.cwd(), "app", "giveaway", "page.tsx"), "utf8");
  check(
    "the giveaway page names Halo, not the retired brand",
    /Hitman Halo/.test(giveaway) && !/[Bb]enji/.test(giveaway)
  );
  const artistPage = readFileSync(
    join(process.cwd(), "app", "artists", "[slug]", "page.tsx"),
    "utf8"
  );
  check(
    "but the old slug still redirects instead of 404ing",
    /"hitman-benji": "hitman-halo"/.test(artistPage),
    "that address is in old DMs and posts; deleting the redirect breaks them"
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
