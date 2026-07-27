/**
 * Rate limits must count what happened, not what was attempted.
 *
 * This exists because of a real lockout. An artist on the roster hit
 * "That's a lot of submissions — try again in an hour" while trying to
 * post a piece, and had posted nothing. The submission limiter charged a
 * slot the moment it was reached — before the artist-status check,
 * before the one-video-a-day cap, before the upload itself — so every
 * failed attempt spent budget. Someone fighting a broken upload burned
 * all ten retries and got locked out for an hour with no piece landing.
 * The limit exists to stop a flood of posts and it was punishing the
 * absence of one.
 *
 * The file-type half of the same bug is checked too: in-app browsers
 * (Facebook, Instagram — where most of this roster actually opens the
 * site) hand over a File with an empty MIME type, and a straight lookup
 * rejected a perfectly good iPhone photo.
 *
 * Run: npm run verify:limits
 */
import { allowAttempt, checkAttempt, spendAttempt, retryLabel } from "../lib/ratelimit";

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const HOUR = 60 * 60 * 1000;

// ---- The lockout that actually happened ----------------------------
{
  const key = "artist-with-a-broken-upload";
  const MAX = 40;
  // Twenty failed attempts. Under the old limiter each of these charged
  // a slot; under the new one a check costs nothing, because nothing
  // was posted.
  for (let i = 0; i < 20; i++) checkAttempt("submit", key, MAX, HOUR);
  const after = checkAttempt("submit", key, MAX, HOUR);
  check("20 failed uploads don't spend any budget", after.ok, `retryAfter ${after.retryAfterMs}`);
}

// ---- The limit still limits ----------------------------------------
{
  const key = "actual-flood";
  const MAX = 5;
  for (let i = 0; i < 5; i++) {
    const g = checkAttempt("flood", key, MAX, HOUR);
    if (g.ok) spendAttempt("flood", key, HOUR);
  }
  const blocked = checkAttempt("flood", key, MAX, HOUR);
  check("5 successful posts exhaust a limit of 5", !blocked.ok, `ok=${blocked.ok}`);
  check("a blocked caller is told how long is left", blocked.retryAfterMs > 0, `${blocked.retryAfterMs}ms`);
  check(
    "the wait is never longer than the window",
    blocked.retryAfterMs <= HOUR,
    `${blocked.retryAfterMs} vs ${HOUR}`
  );
}

// ---- Checking is free, spending is not ------------------------------
{
  const key = "peek";
  const MAX = 2;
  for (let i = 0; i < 50; i++) checkAttempt("peek", key, MAX, HOUR);
  check("checking 50 times still leaves the budget whole", checkAttempt("peek", key, MAX, HOUR).ok);
  spendAttempt("peek", key, HOUR);
  spendAttempt("peek", key, HOUR);
  check("two spends exhaust a limit of two", !checkAttempt("peek", key, MAX, HOUR).ok);
}

// ---- Windows expire -------------------------------------------------
{
  const key = "expiry";
  spendAttempt("tiny", key, 5);
  spendAttempt("tiny", key, 5);
  check("a fresh window still blocks", !checkAttempt("tiny", key, 1, 5).ok);
  // Burn real wall-clock. The first draft of this used a 1ms window and
  // checked immediately, which failed — zero elapsed milliseconds is not
  // past a 1ms window. The limiter was right and the test was wrong.
  const until = Date.now() + 12;
  while (Date.now() < until) {
    /* spin */
  }
  const g = checkAttempt("tiny", key, 1, 5);
  check("an elapsed window resets the budget", g.ok, `retryAfter ${g.retryAfterMs}`);
}

// ---- Buckets and keys stay separate ---------------------------------
{
  spendAttempt("bucketA", "same-user", HOUR);
  check("a spend in one bucket doesn't touch another", checkAttempt("bucketB", "same-user", 1, HOUR).ok);
  spendAttempt("shared", "userA", HOUR);
  check("one user's spend doesn't touch another's", checkAttempt("shared", "userB", 1, HOUR).ok);
}

// ---- allowAttempt still charges, because logins should ---------------
{
  const key = "login";
  for (let i = 0; i < 3; i++) allowAttempt("signin", key, 3, HOUR);
  check(
    "allowAttempt still charges failures — wrong passwords must cost",
    !allowAttempt("signin", key, 3, HOUR)
  );
}

// ---- The message a human reads --------------------------------------
check("under a minute reads as a minute", retryLabel(30_000) === "in a minute", retryLabel(30_000));
check("twelve minutes says twelve", retryLabel(12 * 60_000) === "in 12 minutes", retryLabel(12 * 60_000));
check("an hour says an hour", retryLabel(HOUR) === "in an hour", retryLabel(HOUR));
check("two hours says two", retryLabel(2 * HOUR) === "in 2 hours", retryLabel(2 * HOUR));
check("zero doesn't read as 'in 0 minutes'", retryLabel(0) === "in a minute", retryLabel(0));

// ---- The file-type half of the same outage --------------------------
//
// Mirrors imageExt() in app/actions.ts. Kept in step by asserting the
// exact shapes an in-app browser sends: empty type, octet-stream, and a
// HEIC straight off an iPhone.
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};
function imageExt(file: { type: string; name: string }): string | null {
  const byMime = ALLOWED[file.type];
  if (byMime) return byMime;
  const dot = file.name.lastIndexOf(".");
  if (dot < 0) return null;
  const byName: Record<string, string> = {
    jpg: "jpg", jpeg: "jpg", png: "png", webp: "webp", heic: "heic", heif: "heif",
  };
  return byName[file.name.slice(dot + 1).toLowerCase()] ?? null;
}

check("a normal JPEG works", imageExt({ type: "image/jpeg", name: "a.jpg" }) === "jpg");
check(
  "a photo with NO mime type is accepted on its extension",
  imageExt({ type: "", name: "IMG_8225.JPG" }) === "jpg",
  "the Messenger in-app browser case"
);
check(
  "octet-stream is accepted on its extension",
  imageExt({ type: "application/octet-stream", name: "photo.heic" }) === "heic"
);
check("uppercase extensions work", imageExt({ type: "", name: "IMG_0001.PNG" }) === "png");
check("iPhone HEIC works", imageExt({ type: "image/heic", name: "IMG_1.heic" }) === "heic");
check("a PDF is still refused", imageExt({ type: "application/pdf", name: "receipt.pdf" }) === null);
check("an extensionless unknown is still refused", imageExt({ type: "", name: "noextension" }) === null);
check("a .exe is still refused", imageExt({ type: "", name: "payload.exe" }) === null);

console.log("\n=== RATE LIMITS + UPLOAD TYPES ===");
for (const l of log) console.log(l);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
