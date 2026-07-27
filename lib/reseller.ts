import { prisma } from "./db";

/**
 * The reseller desk — P&L on pairs the house owns.
 *
 * Every number here is computed from cost basis and realised proceeds,
 * never from a gross sale price. A pair that sold for $400 against a
 * $320 cost did not make $80: the channel took a cut and shipping came
 * out of the same pocket. Software that reports the $80 is the reason
 * resellers think they're up while their bank account says otherwise.
 *
 * These figures are also the ones that would go in front of a lender, so
 * they are deliberately conservative in the two places it matters:
 * unrealised gains are reported separately from realised profit and
 * never folded into it, and inventory is valued at the lower of cost and
 * market rather than at whatever the comp says today.
 */

/** Channel fee rates, as percentages of the gross sale price. */
export const CHANNEL_FEE_PCT: Record<string, number> = {
  // Final value fee on sneakers, before the payment processing cut.
  ebay: 13.25,
  // Commission plus cash-out; the seller-side number sneakerheads quote.
  goat: 9.5,
  stockx: 9,
  // Our own storefront: no platform cut, we just eat Stripe.
  heatchart: 0,
  "in-person": 0,
  other: 0,
};

export const STRIPE_PCT = 2.9;
export const STRIPE_FLAT_CENTS = 30;

/** What Stripe takes on a card charge of this size. */
export function stripeFeeCents(grossCents: number): number {
  if (grossCents <= 0) return 0;
  return Math.round((grossCents * STRIPE_PCT) / 100) + STRIPE_FLAT_CENTS;
}

/**
 * Estimated channel take on a gross price. Used to pre-fill the sale
 * form, never to overwrite what actually landed — an estimate that
 * silently replaces a real number is how a ledger stops being evidence.
 */
export function estimateFeeCents(grossCents: number, channel: string): number {
  if (grossCents <= 0) return 0;
  const pct = CHANNEL_FEE_PCT[channel] ?? 0;
  const platform = Math.round((grossCents * pct) / 100);
  // Every channel here settles by card one way or another.
  return platform + stripeFeeCents(grossCents);
}

const DAY = 24 * 60 * 60 * 1000;

export type ItemPnl = {
  costCents: number;
  grossCents: number;
  feeCents: number;
  shipCents: number;
  /** What actually landed: gross minus everything taken out of it. */
  netCents: number;
  /** Net minus cost basis. Negative is a loss, and it says so. */
  profitCents: number;
  /** Profit over gross — margin on revenue, the retail convention. */
  marginPct: number;
  /** Profit over cost — return on the capital tied up in the pair. */
  roiPct: number;
  /** Acquisition to sale, in days. */
  daysHeld: number | null;
  /** Listing to sale, in days. A different question from daysHeld. */
  daysOnMarket: number | null;
};

type SoldLike = {
  costCents: number;
  soldPriceCents: number | null;
  feeCents: number;
  shipCents: number;
  acquiredAt: Date;
  listedAt: Date | null;
  soldAt: Date | null;
};

/** P&L for one sold pair. Null when it hasn't sold — an unsold pair has
 *  no profit, and reporting zero would quietly average it into the wins. */
export function itemPnl(item: SoldLike): ItemPnl | null {
  if (item.soldPriceCents === null || item.soldAt === null) return null;

  const grossCents = item.soldPriceCents;
  const feeCents = item.feeCents;
  const shipCents = item.shipCents;
  const netCents = grossCents - feeCents - shipCents;
  const profitCents = netCents - item.costCents;

  return {
    costCents: item.costCents,
    grossCents,
    feeCents,
    shipCents,
    netCents,
    profitCents,
    marginPct: grossCents > 0 ? round2((profitCents / grossCents) * 100) : 0,
    // A free pair that sells is an infinite return, which is true and
    // useless. Zero cost reports zero ROI rather than Infinity.
    roiPct: item.costCents > 0 ? round2((profitCents / item.costCents) * 100) : 0,
    daysHeld: Math.max(0, Math.round((item.soldAt.getTime() - item.acquiredAt.getTime()) / DAY)),
    daysOnMarket: item.listedAt
      ? Math.max(0, Math.round((item.soldAt.getTime() - item.listedAt.getTime()) / DAY))
      : null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * What a pair is worth today, from the catalog comp. Prefers the eBay
 * used median for worn pairs and the market ask for deadstock, because
 * quoting a DS ask against a beat pair is how inventory gets overvalued.
 * Returns null when there's no comp — an unknown is reported as unknown.
 */
export function compCents(
  condition: string,
  comp: { marketPriceCents: number | null; ebayNewCents: number | null; ebayUsedCents: number | null } | null
): number | null {
  if (!comp) return null;
  if (condition === "USED" || condition === "VNDS") {
    return comp.ebayUsedCents ?? comp.marketPriceCents ?? comp.ebayNewCents ?? null;
  }
  return comp.marketPriceCents ?? comp.ebayNewCents ?? comp.ebayUsedCents ?? null;
}

/**
 * Suggested ask: the comp, floored so the pair can't be listed into a
 * guaranteed loss after the channel's cut. Returns the comp when it
 * already clears the floor, and the floor when it doesn't — along with
 * a flag, because "this comp is under water" is the single most useful
 * thing the desk can tell you before you list.
 */
export function suggestAsk(
  costCents: number,
  compCents: number | null,
  channel: string,
  targetMarginPct = 15
): { askCents: number; underwater: boolean; floorCents: number } {
  const pct = (CHANNEL_FEE_PCT[channel] ?? 0) + STRIPE_PCT;
  // Solve for the gross that leaves cost + target margin after the cut:
  //   gross - gross*pct/100 - flat = cost * (1 + target/100)
  const wanted = costCents * (1 + targetMarginPct / 100) + STRIPE_FLAT_CENTS;
  const floorCents = Math.ceil(wanted / (1 - pct / 100));
  if (compCents === null) return { askCents: floorCents, underwater: false, floorCents };
  return {
    askCents: Math.max(compCents, floorCents),
    underwater: compCents < floorCents,
    floorCents,
  };
}

export type ShelfSnapshot = {
  count: number;
  atCostCents: number;
  /** Lower of cost and comp, per pair — the conservative carrying value. */
  atMarketCents: number;
  /** Comp minus cost across pairs that have a comp. Reported on its own;
   *  it is not profit until something sells. */
  unrealizedCents: number;
  /** How many pairs we could not value, so the number above is read with
   *  the right amount of trust. */
  noCompCount: number;
  aging: { label: string; count: number; atCostCents: number }[];
};

/** Everything currently on the shelf, valued and aged. */
export async function shelfSnapshot(): Promise<ShelfSnapshot> {
  const items = await prisma.inventoryItem.findMany({
    where: { status: { in: ["IN_STOCK", "LISTED"] } },
    select: {
      costCents: true,
      condition: true,
      acquiredAt: true,
      catalogShoe: {
        select: { marketPriceCents: true, ebayNewCents: true, ebayUsedCents: true },
      },
    },
  });

  const buckets = [
    { label: "0–30 days", max: 30, count: 0, atCostCents: 0 },
    { label: "31–60", max: 60, count: 0, atCostCents: 0 },
    { label: "61–90", max: 90, count: 0, atCostCents: 0 },
    { label: "90+ — dead capital", max: Infinity, count: 0, atCostCents: 0 },
  ];

  let atCostCents = 0;
  let atMarketCents = 0;
  let unrealizedCents = 0;
  let noCompCount = 0;
  const now = Date.now();

  for (const it of items) {
    atCostCents += it.costCents;
    const comp = compCents(it.condition, it.catalogShoe);
    if (comp === null) {
      noCompCount++;
      // No comp means no evidence of a gain, so it carries at cost.
      atMarketCents += it.costCents;
    } else {
      atMarketCents += Math.min(it.costCents, comp);
      unrealizedCents += comp - it.costCents;
    }
    const days = (now - it.acquiredAt.getTime()) / DAY;
    const bucket = buckets.find((b) => days <= b.max) ?? buckets[buckets.length - 1];
    bucket.count++;
    bucket.atCostCents += it.costCents;
  }

  return {
    count: items.length,
    atCostCents,
    atMarketCents,
    unrealizedCents,
    noCompCount,
    aging: buckets.map((b) => ({ label: b.label, count: b.count, atCostCents: b.atCostCents })),
  };
}

export type RealizedPnl = {
  sold: number;
  grossCents: number;
  costCents: number;
  feeCents: number;
  shipCents: number;
  netCents: number;
  profitCents: number;
  marginPct: number;
  roiPct: number;
  avgDaysHeld: number | null;
  winners: number;
  losers: number;
};

/** Realised P&L over a window. Losses are counted, not hidden. */
export async function realizedPnl(days = 90): Promise<RealizedPnl> {
  const since = new Date(Date.now() - days * DAY);
  const items = await prisma.inventoryItem.findMany({
    where: { status: "SOLD", soldAt: { gte: since } },
    select: {
      costCents: true,
      soldPriceCents: true,
      feeCents: true,
      shipCents: true,
      acquiredAt: true,
      listedAt: true,
      soldAt: true,
    },
  });

  const rows = items.map(itemPnl).filter((p): p is ItemPnl => p !== null);
  const sum = (pick: (p: ItemPnl) => number) => rows.reduce((t, p) => t + pick(p), 0);

  const grossCents = sum((p) => p.grossCents);
  const costCents = sum((p) => p.costCents);
  const profitCents = sum((p) => p.profitCents);
  const held = rows.map((p) => p.daysHeld).filter((d): d is number => d !== null);

  return {
    sold: rows.length,
    grossCents,
    costCents,
    feeCents: sum((p) => p.feeCents),
    shipCents: sum((p) => p.shipCents),
    netCents: sum((p) => p.netCents),
    profitCents,
    marginPct: grossCents > 0 ? round2((profitCents / grossCents) * 100) : 0,
    roiPct: costCents > 0 ? round2((profitCents / costCents) * 100) : 0,
    avgDaysHeld: held.length > 0 ? Math.round(held.reduce((a, b) => a + b, 0) / held.length) : null,
    winners: rows.filter((p) => p.profitCents > 0).length,
    losers: rows.filter((p) => p.profitCents < 0).length,
  };
}

/**
 * Sell-through over a window: of everything that was available to sell,
 * how much actually moved. Counted against pairs acquired in the window
 * plus what was already on the shelf, because measuring sales against
 * sales always reports 100%.
 */
export async function sellThrough(days = 90): Promise<{ sold: number; available: number; pct: number }> {
  const since = new Date(Date.now() - days * DAY);
  const [sold, onShelf] = await Promise.all([
    prisma.inventoryItem.count({ where: { status: "SOLD", soldAt: { gte: since } } }),
    prisma.inventoryItem.count({ where: { status: { in: ["IN_STOCK", "LISTED"] } } }),
  ]);
  const available = sold + onShelf;
  return { sold, available, pct: available > 0 ? round2((sold / available) * 100) : 0 };
}

/** Per-channel breakdown — which venue actually pays. */
export async function channelPnl(days = 90) {
  const since = new Date(Date.now() - days * DAY);
  const items = await prisma.inventoryItem.findMany({
    where: { status: "SOLD", soldAt: { gte: since } },
    select: {
      soldChannel: true,
      costCents: true,
      soldPriceCents: true,
      feeCents: true,
      shipCents: true,
      acquiredAt: true,
      listedAt: true,
      soldAt: true,
    },
  });

  const byChannel = new Map<string, { sold: number; profitCents: number; grossCents: number }>();
  for (const it of items) {
    const p = itemPnl(it);
    if (!p) continue;
    const key = it.soldChannel ?? "other";
    const row = byChannel.get(key) ?? { sold: 0, profitCents: 0, grossCents: 0 };
    row.sold++;
    row.profitCents += p.profitCents;
    row.grossCents += p.grossCents;
    byChannel.set(key, row);
  }

  return [...byChannel.entries()]
    .map(([channel, r]) => ({
      channel,
      ...r,
      marginPct: r.grossCents > 0 ? round2((r.profitCents / r.grossCents) * 100) : 0,
    }))
    .sort((a, b) => b.profitCents - a.profitCents);
}

/** The shelf, newest first, with a live comp attached to each pair. */
export async function shelf(limit = 200) {
  const items = await prisma.inventoryItem.findMany({
    where: { status: { in: ["IN_STOCK", "LISTED"] } },
    orderBy: { acquiredAt: "asc" }, // oldest first: aging stock needs the attention
    take: limit,
    include: {
      catalogShoe: {
        select: { marketPriceCents: true, ebayNewCents: true, ebayUsedCents: true, imageUrl: true },
      },
    },
  });

  const now = Date.now();
  return items.map((it) => {
    const comp = compCents(it.condition, it.catalogShoe);
    const ask = suggestAsk(it.costCents, comp, "heatchart");
    return {
      ...it,
      compCents: comp,
      suggestCents: ask.askCents,
      underwater: ask.underwater,
      floorCents: ask.floorCents,
      daysHeld: Math.max(0, Math.round((now - it.acquiredAt.getTime()) / DAY)),
      imageUrl: it.imageUrl ?? it.catalogShoe?.imageUrl ?? null,
    };
  });
}

/** What the storefront shows: our own pairs, listed by us, still here. */
export async function storefront(limit = 60) {
  return prisma.inventoryItem.findMany({
    where: {
      publicListed: true,
      status: { in: ["IN_STOCK", "LISTED"] },
      listPriceCents: { not: null },
    },
    orderBy: { listedAt: "desc" },
    take: limit,
    // Explicit select: cost basis, margins and the buyer's address are
    // nobody's business but ours, and an unselected include ships every
    // scalar on the row into the page payload.
    select: {
      id: true,
      name: true,
      brand: true,
      size: true,
      condition: true,
      imageUrl: true,
      extraImages: true,
      listPriceCents: true,
      sku: true,
    },
  });
}
