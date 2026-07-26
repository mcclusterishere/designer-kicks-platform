// Words that ran into each other.
//
// JSX eats the whitespace around an interpolation when the expression and
// the text after it land on different lines. The source looks correct —
// `{PRICE} a year` has a space right there in the file — and the browser
// still renders "$290a year". It survives code review, it survives a
// byte-level check of the source, and it only shows up in the rendered
// output.
//
// This has now shipped twice: "the first 100artists" in the founding
// thank-you, and "$290a year" on the pricing page. Both in prose whose
// entire job is to sound like a person wrote it, which is exactly where a
// glued-together word does the most damage to trust.
//
// A human proofreader cannot be the control for this, because the source
// reads fine. So: fetch the real pages and look for a number butted
// straight against a word across React's own comment separator.
import { BASE, makeChecker } from "./helpers.mjs";

const results = [];
const check = makeChecker(results);

// React separates adjacent text nodes with <!-- -->. A digit or letter on
// one side and a word character on the other, with no space anywhere,
// means two things that should have been separated got glued.
const GLUED = /([0-9A-Za-z])<!-- -->([A-Za-z])/g;

// Legitimate cases: units and currency genuinely run together.
const ALLOWED = /^(?:[0-9]+(?:px|pt|em|rem|%|k|K|m|M|x|X|st|nd|rd|th|s|W|L|d|h)|[A-Za-z])$/;

const PAGES = [
  "/", "/register", "/signin", "/submit", "/pricing", "/security",
  "/market", "/battles", "/drops", "/artists", "/heat-list", "/available",
  "/games", "/news", "/quiz", "/rate", "/story", "/sell", "/careers",
  "/privacy", "/terms", "/rules", "/equity-uprise", "/outfits", "/tournaments",
];

for (const path of PAGES) {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.text();
  const hits = [];
  for (const m of body.matchAll(GLUED)) {
    // Rebuild the words either side so the failure names the real phrase.
    const start = Math.max(0, m.index - 24);
    const context = body.slice(start, m.index + 32).replace(/<!-- -->/g, "");
    const joined = `${m[1]}${m[2]}`;
    if (ALLOWED.test(joined)) continue;
    // A digit glued to a letter is the signature of the bug; letter-to-
    // letter is usually two spans of styled text and is fine.
    if (!/[0-9]/.test(m[1])) continue;
    hits.push(`…${context.trim()}…`);
  }
  check(
    `${path} has no glued words`,
    hits.length === 0,
    hits.slice(0, 3).join("  ||  ") || `${res.status}`
  );
}

console.log("\n=== PROSE: WORDS THAT RAN TOGETHER ===");
for (const r of results) console.log(r);
