/**
 * The reseller desk's arithmetic, recomputed by hand.
 *
 * These numbers decide what to buy, what to dump, and what a lender is
 * shown. A margin function that is quietly wrong doesn't crash — it just
 * reports a profitable business until the bank account disagrees. So
 * every figure below is worked out independently, longhand, and compared
 * against what the library returns.
 *
 * Run: npm run verify:reseller   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import {
  itemPnl,
  stripeFeeCents,
  estimateFeeCents,
  suggestAsk,
  compCents,
  shelfSnapshot,
  realizedPnl,
  sellThrough,
  channelPnl,
  CHANNEL_FEE_PCT,
  STRIPE_PCT,
  STRIPE_FLAT_CENTS,
} from "../lib/reseller";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}
function near(a: number, b: number, tol = 0.01) {
  return Math.abs(a - b) <= tol;
}

const TAG = "verify-reseller";
const made: string[] = [];
let madeShoeId: string | null = null;

async function main() {
  // ---- Pure arithmetic, no database ---------------------------------

  // Stripe on $400.00: 2.9% = $11.60, plus 30c = $11.90.
  check("stripe fee on $400", stripeFeeCents(40000) === 1190, `${stripeFeeCents(40000)}`);
  check("stripe fee on zero is zero", stripeFeeCents(0) === 0);

  // eBay on $400: 13.25% = $53.00, plus Stripe $11.90 = $64.90.
  {
    const got = estimateFeeCents(40000, "ebay");
    const want = Math.round(40000 * 0.1325) + 1190;
    check("eBay fee on $400", got === want && got === 6490, `${got} vs ${want}`);
  }
  // Our own storefront takes no platform cut, only the card fee.
  check("heatchart fee is Stripe only", estimateFeeCents(40000, "heatchart") === 1190, `${estimateFeeCents(40000, "heatchart")}`);
  check("unknown channel charges no platform fee", estimateFeeCents(40000, "nonsense") === 1190);

  // The headline case: $320 cost, sold $400 on eBay, $15 to ship.
  // Fees $64.90, ship $15.00 → net $320.10 → profit $0.10. Practically
  // a wash, which is the entire point of computing it this way.
  {
    const p = itemPnl({
      costCents: 32000,
      soldPriceCents: 40000,
      feeCents: 6490,
      shipCents: 1500,
      acquiredAt: new Date("2026-01-01T00:00:00Z"),
      listedAt: new Date("2026-01-11T00:00:00Z"),
      soldAt: new Date("2026-01-31T00:00:00Z"),
    })!;
    check("net is gross minus fees and shipping", p.netCents === 40000 - 6490 - 1500 && p.netCents === 32010, `${p.netCents}`);
    check("profit is net minus cost", p.profitCents === 32010 - 32000 && p.profitCents === 10, `${p.profitCents}`);
    check("a $400 sale on a $320 pair is not $80 of profit", p.profitCents !== 8000, `${p.profitCents}`);
    check("margin is profit over gross", near(p.marginPct, (10 / 40000) * 100), `${p.marginPct}`);
    check("roi is profit over cost", near(p.roiPct, (10 / 32000) * 100), `${p.roiPct}`);
    check("days held counts acquisition to sale", p.daysHeld === 30, `${p.daysHeld}`);
    check("days on market counts listing to sale", p.daysOnMarket === 20, `${p.daysOnMarket}`);
  }

  // A real loss must report as a loss, with a negative margin.
  {
    const p = itemPnl({
      costCents: 30000,
      soldPriceCents: 25000,
      feeCents: 4000,
      shipCents: 1500,
      acquiredAt: new Date("2026-01-01T00:00:00Z"),
      listedAt: null,
      soldAt: new Date("2026-02-01T00:00:00Z"),
    })!;
    check("a loss is negative", p.profitCents === 25000 - 4000 - 1500 - 30000 && p.profitCents === -10500, `${p.profitCents}`);
    check("a losing margin is negative", p.marginPct < 0, `${p.marginPct}`);
    check("no listing date means no days-on-market", p.daysOnMarket === null);
  }

  check("an unsold pair has no P&L", itemPnl({
    costCents: 10000, soldPriceCents: null, feeCents: 0, shipCents: 0,
    acquiredAt: new Date(), listedAt: null, soldAt: null,
  }) === null);

  check("a free pair reports zero ROI, not Infinity", itemPnl({
    costCents: 0, soldPriceCents: 10000, feeCents: 0, shipCents: 0,
    acquiredAt: new Date("2026-01-01T00:00:00Z"), listedAt: null, soldAt: new Date("2026-01-02T00:00:00Z"),
  })!.roiPct === 0);

  // ---- The floor: listing at the suggested ask must actually clear ---
  {
    const cost = 32000;
    const { floorCents } = suggestAsk(cost, null, "ebay", 15);
    // Sell exactly at the floor and the pair must clear cost + 15%.
    const fee = Math.round((floorCents * CHANNEL_FEE_PCT.ebay) / 100) + stripeFeeCents(floorCents);
    const net = floorCents - fee;
    check(
      "selling at the floor clears cost plus the target margin",
      net >= Math.round(cost * 1.15),
      `net ${net} vs wanted ${Math.round(cost * 1.15)}`
    );
    // And it must not be wildly above — the floor is a floor, not a wish.
    check("the floor isn't padded", net <= Math.round(cost * 1.15) + 200, `net ${net}`);
  }

  // A comp under the floor is the warning that matters most.
  {
    const low = suggestAsk(32000, 33000, "ebay", 15);
    check("a comp below the floor flags underwater", low.underwater === true, `floor ${low.floorCents}`);
    check("an underwater pair is never asked below its floor", low.askCents === low.floorCents, `${low.askCents}`);
    const high = suggestAsk(32000, 60000, "ebay", 15);
    check("a healthy comp is asked at the comp", high.askCents === 60000 && high.underwater === false, `${high.askCents}`);
  }

  // Condition picks the right comp: a beat pair is not worth the DS ask.
  {
    const c = { marketPriceCents: 50000, ebayNewCents: 48000, ebayUsedCents: 30000 };
    check("deadstock comps against the market ask", compCents("DS", c) === 50000, `${compCents("DS", c)}`);
    check("a used pair comps against used", compCents("USED", c) === 30000, `${compCents("USED", c)}`);
    check("VNDS comps against used too", compCents("VNDS", c) === 30000);
    check("no comp data reports null, not zero", compCents("DS", null) === null);
    check("a partial comp falls back rather than guessing",
      compCents("USED", { marketPriceCents: 50000, ebayNewCents: null, ebayUsedCents: null }) === 50000);
  }

  // ---- Against the database -----------------------------------------
  const shoe = await prisma.catalogShoe.create({
    data: {
      sku: `${TAG}-SKU`,
      name: `${TAG} comp shoe`,
      source: "manual",
      marketPriceCents: 50000,
      ebayUsedCents: 30000,
    },
    select: { id: true },
  });
  madeShoeId = shoe.id;

  const add = async (data: Record<string, unknown>) => {
    const it = await prisma.inventoryItem.create({
      data: { name: `${TAG} pair`, size: "10.5", notes: TAG, ...data } as never,
      select: { id: true },
    });
    made.push(it.id);
    return it.id;
  };

  const ago = (d: number) => new Date(Date.now() - d * 86400000);

  // On the shelf: one cheap DS pair with a comp above cost (a real gain),
  // one overpriced pair with a comp below cost (a real loss), one with no
  // comp at all, and one that has been sitting for four months.
  await add({ costCents: 20000, catalogShoeId: shoe.id, condition: "DS", acquiredAt: ago(5) });
  await add({ costCents: 60000, catalogShoeId: shoe.id, condition: "DS", acquiredAt: ago(45) });
  await add({ costCents: 15000, acquiredAt: ago(70) });
  await add({ costCents: 10000, catalogShoeId: shoe.id, condition: "USED", acquiredAt: ago(120) });

  const snap = await shelfSnapshot();
  check("the shelf counts every unsold pair", snap.count === 4, `${snap.count}`);
  check("cost basis totals by hand", snap.atCostCents === 20000 + 60000 + 15000 + 10000, `${snap.atCostCents}`);
  // Unrealised: (50000−20000) + (50000−60000) + (30000−10000) = +40000.
  // The no-comp pair contributes nothing at all.
  check("unrealised is comp minus cost, losses included", snap.unrealizedCents === 30000 - 10000 + 20000, `${snap.unrealizedCents}`);
  check("a pair with no comp is counted as unvalued", snap.noCompCount === 1, `${snap.noCompCount}`);
  // Carrying value is lower-of-cost-or-market, per pair:
  // min(20000,50000) + min(60000,50000) + 15000 + min(10000,30000) = 95000.
  check("inventory carries at the lower of cost and market", snap.atMarketCents === 20000 + 50000 + 15000 + 10000, `${snap.atMarketCents}`);
  check("carrying value never exceeds cost basis", snap.atMarketCents <= snap.atCostCents, `${snap.atMarketCents} vs ${snap.atCostCents}`);
  check("unrealised gain is not folded into carrying value", snap.atMarketCents !== snap.atCostCents + snap.unrealizedCents);

  const aged = snap.aging;
  check("aging buckets split by days held",
    aged[0].count === 1 && aged[1].count === 1 && aged[2].count === 1 && aged[3].count === 1,
    aged.map((a) => `${a.label}:${a.count}`).join(" "));
  check("the 90+ bucket carries its cost", aged[3].atCostCents === 10000, `${aged[3].atCostCents}`);

  // Sold: one clear winner on eBay, one loser on our own storefront.
  await add({
    costCents: 20000, status: "SOLD", soldChannel: "ebay", soldPriceCents: 40000,
    feeCents: 6490, shipCents: 1500, acquiredAt: ago(40), listedAt: ago(30), soldAt: ago(10),
  });
  await add({
    costCents: 30000, status: "SOLD", soldChannel: "heatchart", soldPriceCents: 25000,
    feeCents: 1055, shipCents: 1500, acquiredAt: ago(60), listedAt: ago(50), soldAt: ago(5),
  });

  const pnl = await realizedPnl(90);
  check("realised P&L counts both sales", pnl.sold === 2, `${pnl.sold}`);
  check("gross totals by hand", pnl.grossCents === 65000, `${pnl.grossCents}`);
  // (40000−6490−1500−20000) + (25000−1055−1500−30000) = 12010 + (−7555) = 4455
  check("profit nets the winner against the loser", pnl.profitCents === 12010 - 7555 && pnl.profitCents === 4455, `${pnl.profitCents}`);
  check("winners and losers are both counted", pnl.winners === 1 && pnl.losers === 1, `${pnl.winners}W ${pnl.losers}L`);
  check("blended margin is profit over gross", near(pnl.marginPct, round2((4455 / 65000) * 100)), `${pnl.marginPct}`);
  check("blended ROI is profit over cost", near(pnl.roiPct, round2((4455 / 50000) * 100)), `${pnl.roiPct}`);
  check("average days held is the mean of 30 and 55", pnl.avgDaysHeld === Math.round((30 + 55) / 2), `${pnl.avgDaysHeld}`);

  const st = await sellThrough(90);
  check("sell-through measures sales against everything available",
    st.sold === 2 && st.available === 6 && near(st.pct, round2((2 / 6) * 100)), `${st.sold}/${st.available} = ${st.pct}%`);
  check("sell-through is not reported as 100%", st.pct < 100, `${st.pct}`);

  const chan = await channelPnl(90);
  const ebay = chan.find((c) => c.channel === "ebay");
  const house = chan.find((c) => c.channel === "heatchart");
  check("eBay's profit is attributed to eBay", ebay?.profitCents === 12010, `${ebay?.profitCents}`);
  check("the storefront's loss is attributed to the storefront", house?.profitCents === -7555, `${house?.profitCents}`);
  check("channels are ranked by profit", chan[0].channel === "ebay", chan.map((c) => c.channel).join(","));

  // A sanity check on the constants themselves, so a typo in a fee rate
  // gets caught here rather than in a quarter of bad decisions.
  check("Stripe's rate is 2.9% + 30c", STRIPE_PCT === 2.9 && STRIPE_FLAT_CENTS === 30);
  check("every channel rate is a sane percentage",
    Object.values(CHANNEL_FEE_PCT).every((p) => p >= 0 && p < 30),
    JSON.stringify(CHANNEL_FEE_PCT));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function cleanup() {
  await prisma.inventoryItem.deleteMany({ where: { id: { in: made } } });
  await prisma.inventoryItem.deleteMany({ where: { notes: TAG } });
  if (madeShoeId) await prisma.catalogShoe.deleteMany({ where: { id: madeShoeId } });
  await prisma.catalogShoe.deleteMany({ where: { sku: `${TAG}-SKU` } });
}

main()
  .catch((e) => {
    fail++;
    log.push(`FAIL threw — ${e instanceof Error ? e.message : String(e)}`);
  })
  .then(cleanup)
  .finally(async () => {
    await prisma.$disconnect();
    console.log("\n=== RESELLER DESK: THE MATH ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });
