// The way in has to be on every page, on every screen, always.
//
// This exists because of a real one, reported by an artist over text:
// "do I have to go through 'battle' and not 'home' anymore?" — "you have
// to go through the votes and vote before you can submit your custom."
// They were describing the site accurately.
//
// Submit lived in HeaderNav, which is `md:flex`. When the four-door nav
// shipped, phones lost it: the header rendered a logo, a theme toggle and
// an account chip, and the tab bar's five doors didn't include Post. The
// two remaining links were both conditional — home's rendered only inside
// `battles.length === 0`, and the Arena's only at `battles.length === 0
// || done`. Both are "nothing is happening" states, so the healthier the
// arena got, the harder it became to enter it. An artist on a phone had
// to vote through every open battle before a submit button appeared.
//
// Nothing threw. Every page returned 200. The supply side of a two-sided
// market just quietly had no door, and we found out because someone
// bothered to text instead of leaving.
//
// A visual check wouldn't have caught it either — the desktop link is
// right there in the markup. What matters is whether a link survives on a
// phone, so that's what this asserts: a /submit link that is not
// desktop-only, present unconditionally, on the pages artists actually
// land on.
import { BASE, makeChecker } from "./helpers.mjs";

const results = [];
const check = makeChecker(results);

/** Every <a> pointing at /submit, with its full opening tag. */
function submitLinks(html) {
  return html.match(/<a\b[^>]*href="\/submit"[^>]*>/g) ?? [];
}

/**
 * Tailwind hides the desktop nav below the md breakpoint, so a link is
 * only reachable on a phone if it is NOT inside that nav. The header's
 * mobile Post pill carries `md:hidden` — it is the one that survives.
 * Class strings arrive HTML-escaped, hence the loose match on the token.
 */
function hasMobileReachableSubmit(html) {
  return submitLinks(html).some((tag) => /md:hidden/.test(tag));
}

const PAGES = [
  ["/", "the front page"],
  ["/battles", "the Arena"],
  ["/artists", "the artist index"],
  ["/heat-list", "the Heat List"],
  ["/market", "the Market"],
  ["/drops", "Drops"],
  ["/news", "the newsroom"],
  ["/quiz", "the quiz"],
  ["/profile", "the profile page"],
];

for (const [path, label] of PAGES) {
  const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
  const html = await res.text();
  check(
    `${label} offers a way to post on a phone`,
    hasMobileReachableSubmit(html),
    `${submitLinks(html).length} /submit link(s), ${res.status}`
  );
}

// The specific regression: home used to drop its invitation the moment
// the arena had anything in it. Assert the link is there in the state
// that used to hide it — a front page with live battles on it.
//
// The header's own link doesn't count here. Every page carries that one,
// so `length > 0` would pass on the broken build too — it did, on the
// first draft of this test. What's being asserted is that the page body
// invites you in, so the bar is a link BEYOND the chrome.
{
  const html = await (await fetch(`${BASE}/`)).text();
  const empty = /The arena is warming up/.test(html);
  const inBody = submitLinks(html).length > (hasMobileReachableSubmit(html) ? 2 : 1);
  check(
    "home keeps its invitation while battles are live",
    empty || inBody,
    empty ? "arena empty — page shows its empty-state invite" : `${submitLinks(html).length} link(s)`
  );
}

// And the Arena's own: the deck used to hold its submit CTA behind
// "floor cleared", i.e. behind voting on everything.
{
  const html = await (await fetch(`${BASE}/battles`)).text();
  check(
    "the Arena offers a way in without voting first",
    /Put it on the floor/.test(html) || submitLinks(html).length > 1,
    `${submitLinks(html).length} /submit link(s)`
  );
}

console.log("\n=== ENTRY POINTS: CAN AN ARTIST POST? ===");
for (const r of results) console.log(r);
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
