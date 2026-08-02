/**
 * Scarcity is the site's editorial position, expressed as arithmetic.
 *
 * The catalogue drifted into covering every release — the most crowded
 * content in sneakers — because the importer took whatever the provider
 * sent. The fix is a bar: a pair earns its seat by trading over retail.
 * That bar now exists in two languages, TypeScript for the writes and SQL
 * for the backfill, and two implementations of one rule is the exact
 * shape of a bug that ships quietly. So the centre of this suite is a
 * row-by-row comparison of the two against real Postgres, including every
 * boundary and every missing-price case.
 *
 * The rest guards the two decisions that are easy to undo by accident:
 * that the import filter is ON unless somebody deliberately turns it off,
 * and that a pair ALREADY in the base is always refreshed even when it is
 * common — the gate decides what the catalogue admits, never what it is
 * allowed to know.
 *
 * Run: npm run verify:rarity
 */
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import {
  GRAIL_MULTIPLE,
  HEAT_MULTIPLE,
  RARE_TIERS,
  SHELF_MULTIPLE,
  TIER_LABEL,
  asRarityView,
  isRare,
  multipleLabel,
  rarityFields,
  rarityFor,
  rarityWhere,
} from "../lib/rarity";
import { recomputeRarity } from "../lib/catalog";

const prisma = new PrismaClient();
const TAG = "VERIFYRARITY";

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

/** Fixtures chosen for the boundaries, not the happy path. */
const CASES: {
  sku: string;
  retail: number | null;
  market: number | null;
  eNew: number | null;
  eUsed: number | null;
  tier: string;
  why: string;
}[] = [
  { sku: `${TAG}-GRAIL`, retail: 20000, market: 90000, eNew: null, eUsed: null, tier: "grail", why: "4.5× retail" },
  { sku: `${TAG}-EDGE3`, retail: 20000, market: 60000, eNew: null, eUsed: null, tier: "grail", why: "exactly 3× is a grail, not a near-miss" },
  { sku: `${TAG}-EDGE2`, retail: 20000, market: 40000, eNew: null, eUsed: null, tier: "heat", why: "exactly 2× clears the bar" },
  { sku: `${TAG}-JUST2`, retail: 20000, market: 39999, eNew: null, eUsed: null, tier: "retail", why: "a cent under 2× does not" },
  { sku: `${TAG}-PAR`, retail: 20000, market: 20000, eNew: null, eUsed: null, tier: "retail", why: "sticker price" },
  { sku: `${TAG}-SHELF`, retail: 20000, market: 18000, eNew: null, eUsed: null, tier: "shelf", why: "selling under retail" },
  { sku: `${TAG}-EDGE95`, retail: 20000, market: 19000, eNew: null, eUsed: null, tier: "retail", why: "exactly 0.95× is not yet on shelves" },
  { sku: `${TAG}-NORETAIL`, retail: null, market: 90000, eNew: null, eUsed: null, tier: "unknown", why: "nothing to measure against" },
  { sku: `${TAG}-ZERORET`, retail: 0, market: 90000, eNew: null, eUsed: null, tier: "unknown", why: "zero retail never becomes a division" },
  { sku: `${TAG}-NEGRET`, retail: -500, market: 90000, eNew: null, eUsed: null, tier: "unknown", why: "a negative retail is bad data, not a bargain" },
  { sku: `${TAG}-NOLIVE`, retail: 20000, market: null, eNew: null, eUsed: null, tier: "unknown", why: "nothing trading yet" },
  { sku: `${TAG}-ZEROLIVE`, retail: 20000, market: 0, eNew: 0, eUsed: 0, tier: "unknown", why: "zeroes are absence, not a price of nothing" },
  { sku: `${TAG}-FALLNEW`, retail: 20000, market: null, eNew: 70000, eUsed: 30000, tier: "grail", why: "falls through to the eBay new median" },
  { sku: `${TAG}-FALLUSED`, retail: 20000, market: null, eNew: null, eUsed: 50000, tier: "heat", why: "then to used" },
  { sku: `${TAG}-MKTWINS`, retail: 20000, market: 21000, eNew: 90000, eUsed: 90000, tier: "retail", why: "the primary market price wins even when eBay is higher" },
  { sku: `${TAG}-NEGLIVE`, retail: 20000, market: -900, eNew: 60000, eUsed: null, tier: "grail", why: "a negative price is skipped, not preferred" },
];

async function main() {
  // ---- The thresholds themselves ----------------------------------------
  check(
    "the bars are ordered: grail above heat above shelf",
    GRAIL_MULTIPLE > HEAT_MULTIPLE && HEAT_MULTIPLE > SHELF_MULTIPLE
  );
  check(
    "heat starts at double retail",
    HEAT_MULTIPLE === 2,
    "below that a pair is either still buyable or barely resold, and calling it rare on a site about scarcity loses the people who know"
  );
  check("the shelf line sits just under sticker", SHELF_MULTIPLE < 1);

  // ---- The read ----------------------------------------------------------
  for (const c of CASES) {
    const read = rarityFor({
      retailPriceCents: c.retail,
      marketPriceCents: c.market,
      ebayNewCents: c.eNew,
      ebayUsedCents: c.eUsed,
    });
    check(`${c.sku.replace(TAG + "-", "").toLowerCase()} reads as ${c.tier}`, read.tier === c.tier, c.why);
  }
  check(
    "an unknown tier carries no multiple at all",
    rarityFor({ retailPriceCents: null, marketPriceCents: 9999 }).multiple === null,
    "a missing field must never be dressed up as a number somebody can sort on"
  );
  check(
    "the premium is stated as percent over retail",
    rarityFor({ retailPriceCents: 10000, marketPriceCents: 25000 }).premiumPct === 150
  );
  check(
    "every tier has exactly one name",
    Object.keys(TIER_LABEL).length === 5 &&
      rarityFor({ retailPriceCents: 100, marketPriceCents: 400 }).label === TIER_LABEL.grail,
    "so no surface can rename a tier locally and disagree with the filter chip"
  );

  // ---- What counts as rare ----------------------------------------------
  check("rare means grail or heat, nothing else", RARE_TIERS.join(",") === "grail,heat");
  check("a grail is rare", isRare({ retailPriceCents: 10000, marketPriceCents: 50000 }));
  check("a pair at sticker is not", !isRare({ retailPriceCents: 10000, marketPriceCents: 10000 }));
  check(
    "an unpriced pair is not rare either",
    !isRare({ retailPriceCents: 10000 }),
    "unproven is not the same as qualified"
  );

  // ---- The view the board hands to SQL -----------------------------------
  check("an unknown view falls back to everything", asRarityView("nonsense") === "all");
  check("a missing view falls back to everything", asRarityView(undefined) === "all");
  check("rare and grail survive round-tripping", asRarityView("GRAIL ") === "grail" && asRarityView("rare") === "rare");
  check(
    "the everything view adds no filter at all",
    Object.keys(rarityWhere("all")).length === 0,
    "or the base stops being usable as a SKU lookup"
  );
  check(
    "the rare view filters on the stored tier, not on a price threshold",
    JSON.stringify(rarityWhere("rare")) === JSON.stringify({ rarityTier: { in: RARE_TIERS } }),
    "a fixed price floor would call a $600 general release rare and a $90 grail common"
  );
  check("the grail view is exactly the top tier", JSON.stringify(rarityWhere("grail")) === JSON.stringify({ rarityTier: "grail" }));
  check("a multiple renders to one decimal", multipleLabel(3.44) === "3.4×");
  check("and a missing one renders to nothing", multipleLabel(null) === null && multipleLabel(0) === null);

  // ---- SQL vs TypeScript, on a real database -----------------------------
  for (const c of CASES) {
    await prisma.catalogShoe.upsert({
      where: { sku: c.sku },
      update: {
        retailPriceCents: c.retail, marketPriceCents: c.market,
        ebayNewCents: c.eNew, ebayUsedCents: c.eUsed,
        // Wiped first so a pass proves the backfill wrote them, not that
        // an earlier run left the right answer lying around.
        rarityTier: null, rarityMultiple: null,
      },
      create: {
        sku: c.sku, name: `verify ${c.sku}`, source: "verify",
        retailPriceCents: c.retail, marketPriceCents: c.market,
        ebayNewCents: c.eNew, ebayUsedCents: c.eUsed,
      },
    });
  }

  const touched = await recomputeRarity();
  check("the backfill rewrote the rows it had to", touched >= CASES.length);
  const second = await recomputeRarity();
  check(
    "and running it again rewrites nothing",
    second === 0,
    "it runs on every catalog refresh, so a full-table rewrite each time would churn the database for no reason"
  );

  const rows = await prisma.catalogShoe.findMany({
    select: {
      sku: true, retailPriceCents: true, marketPriceCents: true,
      ebayNewCents: true, ebayUsedCents: true, rarityTier: true, rarityMultiple: true,
    },
  });
  let disagreed = 0;
  for (const r of rows) {
    const want = rarityFor(r);
    const tierOk = r.rarityTier === want.tier;
    const multOk =
      want.multiple === null
        ? r.rarityMultiple === null
        : r.rarityMultiple !== null && Math.abs(r.rarityMultiple - want.multiple) < 1e-9;
    if (!tierOk || !multOk) {
      disagreed++;
      if (disagreed <= 5) {
        log.push(`     ${r.sku}: sql=${r.rarityTier}/${r.rarityMultiple} ts=${want.tier}/${want.multiple}`);
      }
    }
  }
  check(
    `the SQL backfill agrees with rarityFor() on all ${rows.length} rows in the base`,
    disagreed === 0,
    disagreed ? `${disagreed} rows disagree` : "including every boundary and every missing-price case"
  );

  // The stored columns are what the board filters on, so they have to be
  // the same numbers the read produces — not a rounding of them.
  const sample = CASES.find((c) => c.sku.endsWith("GRAIL"))!;
  const fields = rarityFields({
    retailPriceCents: sample.retail, marketPriceCents: sample.market,
    ebayNewCents: sample.eNew, ebayUsedCents: sample.eUsed,
  });
  check(
    "the persisted columns are a straight copy of the read",
    fields.rarityTier === "grail" && fields.rarityMultiple === 4.5
  );

  // A rare-view query against the real table returns rare pairs only.
  const rareRows = await prisma.catalogShoe.findMany({
    where: { sku: { startsWith: TAG }, ...rarityWhere("rare") },
    select: { sku: true, rarityTier: true },
  });
  check(
    "a rare-view query returns nothing but grails and heat",
    rareRows.length > 0 && rareRows.every((r) => RARE_TIERS.includes(r.rarityTier as never)),
    "this is the query behind the board's chip, so it has to page in SQL and still be exact"
  );
  check(
    "and it is sortable, because the multiple is a column",
    (await prisma.catalogShoe.findMany({
      where: { sku: { startsWith: TAG }, ...rarityWhere("rare") },
      orderBy: { rarityMultiple: "desc" },
      take: 1,
      select: { sku: true },
    }))[0]?.sku === `${TAG}-GRAIL`
  );

  await prisma.catalogShoe.deleteMany({ where: { sku: { startsWith: TAG } } });

  // ---- Wiring: the importer ----------------------------------------------
  const catalog = readFileSync(join(process.cwd(), "lib", "catalog.ts"), "utf8");
  check(
    "the filter is on unless a caller deliberately opts out",
    /const rareOnly = opts\.rareOnly !== false;/.test(catalog),
    "defaulting to off would mean the one place that forgets the flag re-floods the base"
  );
  check(
    "a pair already in the catalog is refreshed even when it is common",
    /if \(rareOnly && !existing && \(rarity\.tier === "shelf" \|\| rarity\.tier === "retail"\)\)/.test(catalog),
    "otherwise a shoe frozen at last year's price can never be seen to have spiked"
  );
  check(
    "an unpriced pair is kept, not thrown away",
    !/rarity\.tier === "unknown"[\s\S]{0,60}skipped\+\+/.test(catalog),
    "pricing arrives later on the eBay sync; discarding it now means never finding out"
  );
  check(
    "rarity is read off the merged row, not off the payload in hand",
    /rarityFor\(\{ \.\.\.\(existing \?\? \{\}\), \.\.\.gained \}\)/.test(catalog),
    "a slim response with a market price but no retail is still a grail if we already knew the retail"
  );
  check(
    "every write persists the two columns",
    /update: \{ \.\.\.gained, \.\.\.rarityData \}/.test(catalog) &&
      /create: \{ sku, \.\.\.data, \.\.\.rarityData \}/.test(catalog)
  );
  check(
    "the skipped count is reported, not swallowed",
    /skipped: number;/.test(catalog) && (catalog.match(/skipped,/g) ?? []).length >= 4,
    "an import that turns away 400 shoes and says nothing looks broken"
  );
  check(
    "the backfill takes its thresholds from the constants, never from literals",
    /const g = Number\(GRAIL_MULTIPLE\)/.test(catalog) &&
      /const h = Number\(HEAT_MULTIPLE\)/.test(catalog) &&
      /const s = Number\(SHELF_MULTIPLE\)/.test(catalog),
    "hardcoding 3 and 2 into the SQL is how the two definitions drift apart"
  );
  check(
    "the backfill only rewrites rows whose cached value is actually wrong",
    /IS DISTINCT FROM/.test(catalog)
  );
  check(
    "a catalog refresh rebuilds the cache afterwards",
    (catalog.match(/await recomputeRarity\(\)/g) ?? []).length >= 2,
    "prices just moved, so every tier the run touched is stale"
  );

  // ---- Wiring: the eBay sync owns the other half of the read -------------
  const ebay = readFileSync(join(process.cwd(), "lib", "ebay.ts"), "utf8");
  check(
    "the eBay sync recomputes rarity when it moves the price",
    /\.\.\.rarityFields\(\{/.test(ebay),
    "eBay is often the only live number a pair has, so this write IS the tier"
  );
  check(
    "and it feeds the recompute the retail it just read",
    /retailPriceCents: true,[\s\S]{0,80}marketPriceCents: true,/.test(ebay)
  );

  // ---- Wiring: the board -------------------------------------------------
  const board = readFileSync(join(process.cwd(), "components", "CatalogBoard.tsx"), "utf8");
  check(
    "the board filters in SQL off the stored column",
    /\.\.\.rarityWhere\(rarity\)/.test(board),
    "filtering a page in memory would make the count and the pager lie"
  );
  check(
    "the brand rail counts the same set the grid shows",
    (board.match(/\.\.\.rarityWhere\(rarity\)/g) ?? []).length >= 2,
    "a brand chip promising 40 pairs that opens on 3 is worse than no chip"
  );
  check(
    "a rarity view sorts by how far over retail a pair trades",
    /rarityMultiple: \{ sort: "desc" as const, nulls: "last" as const \}/.test(board)
  );
  check(
    "the view travels with search, brand, lane and page",
    /\.\.\.\(r !== "all" \? \{ rarity: r \} : \{\}\)/.test(board) &&
      /name="rarity" value=\{rarity\}/.test(board),
    "a filter that drops off when you search is a filter nobody trusts"
  );
  check(
    "the tile badge reads the stored tier rather than recomputing one",
    /s\.rarityTier as RarityTier \| null/.test(board),
    "recomputing here is how a tile ends up badged differently from the chip that selected it"
  );
  check(
    "an empty rare view offers the way out",
    /Show everything/.test(board),
    "a brand-new base has no pricing yet, and a dead end reads as a broken page"
  );

  const market = readFileSync(join(process.cwd(), "app", "market", "page.tsx"), "utf8");
  check("the market page forwards the param", /rarity=\{rarity\}/.test(market));

  const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  check(
    "the filter and sort have an index behind them",
    /@@index\(\[rarityTier, rarityMultiple\]\)/.test(schema)
  );

  const panel = readFileSync(join(process.cwd(), "app", "admin", "CatalogPanel.tsx"), "utf8");
  check(
    "the admin opt-out is a checkbox that has to be ticked",
    /name="includeCommon"/.test(panel) && !/defaultChecked/.test(panel),
    "an unticked box is simply absent from the POST, so forgetting it keeps the filter on"
  );
  const actions = readFileSync(join(process.cwd(), "app", "actions.ts"), "utf8");
  check(
    "and the action reads it as an opt-out, not an opt-in",
    /rareOnly: !includeCommon/.test(actions)
  );
  check(
    "the admin is told how many were turned away",
    /skipped: res\.skipped/.test(actions) && /commoner\{state\.skipped === 1 \? "" : "s"\} turned away/.test(panel)
  );

  console.log(log.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.catalogShoe.deleteMany({ where: { sku: { startsWith: TAG } } }).catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
