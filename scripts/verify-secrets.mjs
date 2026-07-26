/**
 * Nothing secret is allowed to be committed.
 *
 * This exists because two things were. `.env.example` is tracked, this
 * repository is public, and it shipped a real `AUTH_SECRET` and a real
 * `ADMIN_PASSWORD` from the first commit — for nine days, on GitHub, in
 * plain sight. AUTH_SECRET signs every session cookie, so publishing it
 * is not a config nit: anyone holding it can mint a valid session for any
 * account, including an admin one, without ever seeing a password.
 *
 * Nobody did it carelessly. A working value in an example file is the
 * most natural thing in the world to write while you are getting the
 * thing to run at all, and it is invisible forever afterwards because the
 * file reads as documentation rather than as configuration. That is
 * exactly the sort of mistake that needs a machine watching for it, not a
 * person remembering.
 *
 * So: every sensitive key in a COMMITTED env file must be empty. The real
 * values live in .env (git-ignored) and in the host's own settings.
 *
 * Run: npm run verify:secrets   (no database, no network — safe anywhere)
 */
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";

let pass = 0;
let fail = 0;
const log = [];
function check(name, ok, extra = "") {
  ok ? pass++ : fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

/**
 * Keys whose value is a credential. Anything matching must be blank in a
 * tracked file. Substring match, so KICKSDB_KEY is caught by "KEY".
 */
const SENSITIVE = [
  "SECRET", "PASSWORD", "TOKEN", "KEY", "CREDENTIAL", "PRIVATE", "DSN", "WEBHOOK",
];

/**
 * Names that end in a sensitive word but hold a public identifier, not a
 * credential. Listed explicitly, because a blanket allowance for "ID" or
 * "PUBLIC" would wave through the next real leak.
 */
const PUBLIC_BY_DESIGN = new Set([
  "S3_ACCESS_KEY_ID",     // paired with the secret; useless alone
  "VAPID_PUBLIC_KEY",     // published to browsers by definition
  "GOOGLE_CLIENT_ID",     // shown in the OAuth redirect
  "FACEBOOK_CLIENT_ID",
  "EBAY_CLIENT_ID",
  "FB_PAGE_ID",
  "IG_USER_ID",
]);

function trackedEnvFiles() {
  const out = execSync("git ls-files", { encoding: "utf8" });
  return out
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f && (f === ".env.example" || /(^|\/)\.env($|\.)/.test(f)));
}

const files = trackedEnvFiles();
check(
  "the real .env is not tracked",
  !files.some((f) => f === ".env" || f.endsWith("/.env")),
  files.join(", ") || "none tracked"
);
check("there is a committed .env.example to check", files.includes(".env.example"));

for (const file of files) {
  if (!existsSync(file)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  const offenders = [];
  lines.forEach((line, i) => {
    const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (!m) return;
    const [, key, rawValue] = m;
    if (PUBLIC_BY_DESIGN.has(key)) return;
    if (!SENSITIVE.some((s) => key.includes(s))) return;
    const value = rawValue.trim().replace(/^["']|["']$/g, "");
    // A template placeholder is documentation, not a credential.
    if (value === "" || /^(your|xxx|changeme|placeholder|<)/i.test(value)) return;
    offenders.push(`${file}:${i + 1} ${key}`);
  });
  check(
    `${file} carries no live credential`,
    offenders.length === 0,
    offenders.join("; ")
  );
}

// The AUTH_SECRET value that leaked, checked across the WHOLE tree.
//
// A signing key has no legitimate home in source — not in a test, not in
// a doc, not as a fallback — so any occurrence anywhere is a failure. It
// is named rather than pattern-matched so that if it comes back by a
// revert or a merge, the message says which secret rather than "a secret".
const tree = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
const authHits = tree.filter((f) => {
  if (f === "scripts/verify-secrets.mjs") return false; // this file names it on purpose
  try {
    return readFileSync(f, "utf8").includes("X1UGcan4uxIZfINeLx9");
  } catch {
    return false; // binary or unreadable
  }
});
check("the exposed AUTH_SECRET value appears nowhere in the tree", authHits.length === 0, authHits.join(", "));

// ADMIN_PASSWORD is deliberately NOT checked tree-wide.
//
// lib/admin.ts carries "heatcheck" as a local-development default and
// that is correct: it reads the env var first and, in production with
// nothing set, returns null and disables admin login altogether rather
// than falling back. A dev default that refuses to exist in production is
// the right pattern, and a scanner that fails it would be teaching the
// wrong lesson. What mattered was that the same string sat in a committed
// .env.example as the documented production value — and the per-file rule
// above already covers that.
const prodGuard = readFileSync("lib/admin.ts", "utf8");
check(
  "the dev admin password cannot be used in production",
  /NODE_ENV === "production"\s*\?\s*null/.test(prodGuard),
  "lib/admin.ts adminPassword() must return null in prod when unset"
);
check(
  "production refuses to sign admin cookies without AUTH_SECRET",
  /AUTH_SECRET must be set in production/.test(prodGuard)
);

console.log("\n=== COMMITTED SECRETS ===");
for (const l of log) console.log(l);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(
    "\nRotate the value at its source before doing anything else — deleting it\n" +
      "from the file does not un-publish it. Git history keeps every version."
  );
}
process.exit(fail === 0 ? 0 : 1);
