// Structural and arithmetic check on the question banks.
//
// Run: npm run verify:questions
//
// A wrong answer in a trivia game is embarrassing. A wrong answer in the
// markets bank teaches somebody a false thing about money and then burns it
// into their IQ ledger, where it can never be re-answered. So every question
// that contains a calculation gets recomputed here from first principles,
// independently of how it was written, and the stated answer has to match.
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(path.join(here, "..", "prisma", f), "utf8"));

const results = [];
let failed = 0;
const check = (name, ok, extra = "") => {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failed++;
};

const culture = load("questions.json");
const markets = [
  ...load("market-questions.json"),
  // Instruments, ported from the Street Credit Bureau taxonomy. Same bank,
  // same rules — anything that teaches has to survive the same checks.
  ...load("instrument-questions.json"),
];

// ---------- Structure ----------
for (const [bank, rows, needsLesson] of [
  ["culture", culture, false],
  ["markets", markets, true],
]) {
  let problems = [];
  const seenText = new Set();
  const seenConcept = new Set();
  for (const [i, q] of rows.entries()) {
    const at = `${bank}[${i}]`;
    if (!q.question?.trim()) problems.push(`${at} empty question`);
    if (!Array.isArray(q.options) || q.options.length !== 4) problems.push(`${at} needs 4 options`);
    else if (new Set(q.options).size !== 4) problems.push(`${at} duplicate options`);
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3)
      problems.push(`${at} answerIndex out of range`);
    if (![1, 2, 3].includes(q.difficulty)) problems.push(`${at} difficulty must be 1-3`);
    if (seenText.has(q.question)) problems.push(`${at} duplicate question text`);
    seenText.add(q.question);
    if (needsLesson) {
      if (!q.lesson?.trim()) problems.push(`${at} missing lesson`);
      if (!q.explanation?.trim()) problems.push(`${at} missing explanation`);
      if (!q.concept?.trim()) problems.push(`${at} missing concept`);
      else if (seenConcept.has(q.concept)) problems.push(`${at} duplicate concept ${q.concept}`);
      else seenConcept.add(q.concept);
      if (!Number.isInteger(q.level) || q.level < 1 || q.level > 8)
        problems.push(`${at} level must be 1-8`);
    }
  }
  check(`${bank} bank is structurally sound (${rows.length} questions)`, problems.length === 0,
    problems.slice(0, 4).join("; "));
}

// Every level should actually be populated, or the ladder has a dead rung.
const byLevel = {};
for (const q of markets) byLevel[q.level] = (byLevel[q.level] ?? 0) + 1;
check("every level 1-8 has questions", [1, 2, 3, 4, 5, 6, 7, 8].every((l) => (byLevel[l] ?? 0) >= 5),
  JSON.stringify(byLevel));

// ---------- Arithmetic ----------
// Each entry recomputes the answer from the scenario's numbers. The point is
// to derive it here rather than restate what the JSON claims.
const byConcept = new Map(markets.map((q) => [q.concept, q]));

function expects(concept, expected, workingNote) {
  const q = byConcept.get(concept);
  if (!q) return check(`arithmetic: ${concept}`, false, "question not found");
  const stated = q.options[q.answerIndex];
  check(`arithmetic: ${concept}`, stated === expected,
    `bank says "${stated}", recomputed "${expected}" (${workingNote})`);
}

const money = (n) => `$${n.toLocaleString("en-US")}`;

// Buy at the $240 ask, sell at the $180 bid.
expects("bid-ask-spread", `${money(240 - 180)} loss`, "ask 240 - bid 180");

// $250 sale, 10% fee, $15 shipping, $200 cost.
expects("transaction-costs", money(250 - 250 * 0.1 - 15 - 200), "250 - 25 fee - 15 ship - 200 cost");

// 300 pairs at $2,000 vs 50,000 pairs at $400.
expects("market-cap-vs-price", 300 * 2000 > 50000 * 400 ? "Shoe A" : "Shoe B",
  `${money(300 * 2000)} vs ${money(50000 * 400)}`);

// $90/month for 12 months against a $1,200 gain.
{
  const net = 1200 - 90 * 12;
  expects("cost-of-carry", net > 0 ? `Up ${money(net)}` : `Down ${money(-net)}`,
    "1200 gain - 1080 storage");
}

// Peak 900, trough 500.
expects("drawdown", `${Math.round(((900 - 500) / 900) * 100)}%`, "(900-500)/900");

// 12% fee: need gross G where G * 0.88 = 300.
expects("breakeven-with-fees", money(Math.round(300 / 0.88)), "300 / 0.88");

// One at $600, one at $400.
expects("averaging-down", money((600 + 400) / 2), "(600+400)/2");

// Strike 500, worth 700, premium 40.
expects("option-payoff", money(700 - 500 - 40), "700 - 500 strike - 40 premium");

// Sold short at 500, bought back at 2400.
expects("unlimited-downside", `${money(2400 - 500)}, and it could have gone higher`,
  "2400 - 500");

// $2,000 equity, $10,000 position, 20% fall.
{
  const loss = 10000 * 0.2;
  expects("leverage", loss >= 2000 ? "Wiped out — down 100%" : "Down 20%",
    `${money(loss)} loss against ${money(2000)} equity`);
}

// Expiring below strike: walk away, lose only the premium.
expects("option-expiry", `Let it expire and lose ${money(40)}`,
  "430 < 500 strike, so exercising is worse than not");

console.log(results.join("\n"));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
