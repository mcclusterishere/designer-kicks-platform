import { prisma } from "./db";

/**
 * The Call — a prediction market on real resale movement.
 *
 * The rule that keeps it honest: every call records the price it was made
 * against, and settlement compares that to the price we actually recorded
 * later. Nobody adjudicates. If the market never gave us a reading to
 * settle against, the call is VOIDed rather than guessed at, so a missing
 * data point can never cost someone their record.
 *
 * Scoring rewards conviction that turns out right:
 *  - DIRECTION: 10 base, doubled when you were on the minority side. Calling
 *    the obvious with the crowd is worth less than seeing what they didn't.
 *  - PRICE: up to 25, scaled by how close you landed as a share of the real
 *    number, so a $40 miss on a $200 pair costs far more than on a $2,000 one.
 */

export const HORIZONS = [7, 30] as const;
export type Horizon = (typeof HORIZONS)[number];

const DAY = 86_400_000;

/** The number a call is judged against — live resale, else the eBay ask. */
export function marketPrice(shoe: {
  marketPriceCents: number | null;
  ebayNewCents: number | null;
}): number | null {
  return shoe.marketPriceCents || shoe.ebayNewCents || null;
}

export function scoreDirection(minoritySide: boolean): number {
  return minoritySide ? 20 : 10;
}

export function scorePrice(predictedCents: number, actualCents: number): number {
  if (actualCents <= 0) return 0;
  const errPct = (Math.abs(predictedCents - actualCents) / actualCents) * 100;
  // Dead on = 25, degrading to nothing by a 25% miss.
  return Math.max(0, Math.round(25 - errPct));
}

export type CallInput = {
  userId: string;
  shoeId: string;
  kind: "DIRECTION" | "PRICE";
  horizonDays: number;
  direction?: "UP" | "DOWN";
  predictedCents?: number;
};

export async function makeCall(input: CallInput): Promise<{ ok: boolean; error?: string }> {
  const horizon = HORIZONS.includes(input.horizonDays as Horizon) ? input.horizonDays : null;
  if (!horizon) return { ok: false, error: "Pick a 7 or 30 day window." };

  const shoe = await prisma.catalogShoe.findUnique({
    where: { id: input.shoeId },
    select: { id: true, marketPriceCents: true, ebayNewCents: true },
  });
  if (!shoe) return { ok: false, error: "That pair isn't on the board." };

  const basis = marketPrice(shoe);
  if (!basis) return { ok: false, error: "No live price on that pair yet — nothing to call against." };

  const existing = await prisma.prediction.findFirst({
    where: { userId: input.userId, shoeId: shoe.id, horizonDays: horizon, status: "OPEN" },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "You already have an open call on this pair at that window." };

  if (input.kind === "DIRECTION" && input.direction !== "UP" && input.direction !== "DOWN") {
    return { ok: false, error: "Call it up or down." };
  }
  if (input.kind === "PRICE") {
    const c = input.predictedCents ?? 0;
    if (!Number.isFinite(c) || c <= 0) return { ok: false, error: "Give a real price." };
    if (c > 5_000_000_00) return { ok: false, error: "That price isn't realistic." };
  }

  await prisma.prediction.create({
    data: {
      userId: input.userId,
      shoeId: shoe.id,
      kind: input.kind,
      horizonDays: horizon,
      basisCents: basis,
      direction: input.kind === "DIRECTION" ? input.direction : null,
      predictedCents: input.kind === "PRICE" ? input.predictedCents : null,
      resolveAt: new Date(Date.now() + horizon * DAY),
    },
  });
  return { ok: true };
}

/**
 * Settle everything whose window has closed. Idempotent per row: the
 * status filter means a second pass finds nothing left to settle, so a
 * double-run can never pay twice.
 */
export async function resolveDuePredictions(limit = 300): Promise<{
  settled: number;
  voided: number;
  pointsAwarded: number;
}> {
  const due = await prisma.prediction.findMany({
    where: { status: "OPEN", resolveAt: { lte: new Date() } },
    orderBy: { resolveAt: "asc" },
    take: limit,
    include: { shoe: { select: { marketPriceCents: true, ebayNewCents: true } } },
  });
  if (due.length === 0) return { settled: 0, voided: 0, pointsAwarded: 0 };

  // Crowd split per (shoe, horizon) so contrarian calls can be identified.
  const groups = new Map<string, { up: number; down: number }>();
  for (const p of due) {
    if (p.kind !== "DIRECTION") continue;
    const k = `${p.shoeId}:${p.horizonDays}`;
    const g = groups.get(k) ?? { up: 0, down: 0 };
    if (p.direction === "UP") g.up++;
    else g.down++;
    groups.set(k, g);
  }

  let settled = 0, voided = 0, pointsAwarded = 0;

  for (const p of due) {
    const actual = marketPrice(p.shoe);
    // No reading to settle against — void it. Never guess someone's record.
    if (!actual) {
      await prisma.prediction.update({
        where: { id: p.id },
        data: { status: "VOID", settledAt: new Date() },
      }).catch(() => {});
      voided++;
      continue;
    }

    let correct = false;
    let points = 0;

    if (p.kind === "DIRECTION") {
      const moved = actual - p.basisCents;
      const wentUp = moved > 0;
      // A flat market resolves against both sides — no free points for noise.
      correct = moved !== 0 && ((p.direction === "UP" && wentUp) || (p.direction === "DOWN" && !wentUp));
      if (correct) {
        const g = groups.get(`${p.shoeId}:${p.horizonDays}`) ?? { up: 0, down: 0 };
        const mySide = p.direction === "UP" ? g.up : g.down;
        const otherSide = p.direction === "UP" ? g.down : g.up;
        points = scoreDirection(mySide < otherSide);
      }
    } else {
      points = scorePrice(p.predictedCents ?? 0, actual);
      correct = points > 0;
    }

    await prisma.prediction.update({
      where: { id: p.id },
      data: { status: "SETTLED", actualCents: actual, correct, points, settledAt: new Date() },
    }).catch(() => {});

    if (points > 0) {
      // Winning calls pay Culture credits on the same rail as the quiz.
      const { grantCredits } = await import("./quiz");
      await grantCredits(p.userId, Math.max(1, Math.round(points / 10)), "prediction").catch(() => {});
      pointsAwarded += points;
    }
    settled++;
  }

  return { settled, voided, pointsAwarded };
}

export type TrackRecord = {
  open: number;
  settled: number;
  hits: number;
  accuracyPct: number | null;
  points: number;
};

export async function getTrackRecord(userId: string): Promise<TrackRecord> {
  const [open, rows] = await Promise.all([
    prisma.prediction.count({ where: { userId, status: "OPEN" } }),
    prisma.prediction.findMany({
      where: { userId, status: "SETTLED" },
      select: { correct: true, points: true },
    }),
  ]);
  const hits = rows.filter((r) => r.correct).length;
  const points = rows.reduce((s, r) => s + (r.points ?? 0), 0);
  return {
    open,
    settled: rows.length,
    hits,
    accuracyPct: rows.length > 0 ? Math.round((hits / rows.length) * 100) : null,
    points,
  };
}

export type CallerRow = { name: string; points: number; accuracyPct: number; settled: number; you: boolean };

/** Who actually reads the market. Minimum sample so one lucky call can't top it. */
export async function getCallerBoard(meId: string | null, minSettled = 3): Promise<CallerRow[]> {
  const rows = await prisma.prediction.findMany({
    where: { status: "SETTLED" },
    select: { userId: true, correct: true, points: true, user: { select: { name: true } } },
  });
  const by = new Map<string, { name: string; pts: number; hits: number; n: number }>();
  for (const r of rows) {
    const e = by.get(r.userId) ?? { name: r.user.name || "Caller", pts: 0, hits: 0, n: 0 };
    e.pts += r.points ?? 0;
    if (r.correct) e.hits++;
    e.n++;
    by.set(r.userId, e);
  }
  return [...by.entries()]
    .filter(([, e]) => e.n >= minSettled)
    .map(([id, e]) => ({
      name: e.name,
      points: e.pts,
      accuracyPct: Math.round((e.hits / e.n) * 100),
      settled: e.n,
      you: id === meId,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 25);
}

/** The slate: pairs with a live price worth calling, upcoming drops first. */
export async function getCallSlate(limit = 18) {
  const shoes = await prisma.catalogShoe.findMany({
    where: {
      OR: [{ marketPriceCents: { gt: 0 } }, { ebayNewCents: { gt: 0 } }],
      imageUrl: { not: null },
    },
    orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }],
    take: limit,
    select: {
      id: true, sku: true, name: true, brand: true, imageUrl: true,
      marketPriceCents: true, ebayNewCents: true, retailPriceCents: true, releaseDate: true,
    },
  });
  return shoes.map((s) => ({
    id: s.id,
    sku: s.sku,
    name: s.name,
    brand: s.brand,
    imageUrl: s.imageUrl,
    lastCents: marketPrice(s) ?? 0,
    retailCents: s.retailPriceCents,
    releaseDate: s.releaseDate,
  }));
}
