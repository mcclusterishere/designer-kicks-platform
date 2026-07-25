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

export const STAKES = [5, 10, 25, 50] as const;

/**
 * What a winning call pays, as a multiple of the stake.
 *
 * Direction pays even money doubled when you were the minority — the same
 * shape as the points scoring, so the incentive to be early rather than
 * agreeable survives into the credits. A price call pays on accuracy, up to
 * triple, because calling a number is strictly harder than calling a way.
 *
 * Stakes are Culture credits, which are earned by playing and can be bought
 * for entries — they are not currency and never pay out as money. That's
 * deliberate: the moment a wrong call costs someone real money this stops
 * being a game and starts being something that needs a licence.
 */
export function payoutFor(stake: number, kind: "DIRECTION" | "PRICE", points: number, minority: boolean): number {
  if (points <= 0) return 0;
  if (kind === "DIRECTION") return Math.round(stake * (minority ? 3 : 2));
  // PRICE: points run 1..25, so accuracy scales the multiple from ~1.1x to 3x.
  return Math.round(stake * (1 + (points / 25) * 2));
}

export type CallInput = {
  userId: string;
  /** Exactly one of these. OG calls carry a shoe, customs carry a piece. */
  shoeId?: string;
  submissionId?: string;
  kind: "DIRECTION" | "PRICE";
  horizonDays: number;
  direction?: "UP" | "DOWN";
  predictedCents?: number;
  /** Credits at risk. Debited now, returned with winnings on a hit. */
  stakeCredits?: number;
};

export async function makeCall(input: CallInput): Promise<{ ok: boolean; error?: string; note?: string }> {
  const horizon = HORIZONS.includes(input.horizonDays as Horizon) ? input.horizonDays : null;
  if (!horizon) return { ok: false, error: "Pick a 7 or 30 day window." };

  const onOg = Boolean(input.shoeId);
  const onCustom = Boolean(input.submissionId);
  if (onOg === onCustom) return { ok: false, error: "Pick one pair to call." };

  // Self-exclusion blocks the act, not just the stake. A free call is still
  // play, and honouring a break only when money is involved isn't honouring
  // it — the ledger's own check would miss this case entirely.
  const { isExcluded } = await import("./ledger");
  const breakUntil = await isExcluded(input.userId);
  if (breakUntil) {
    return {
      ok: false,
      error: `You're on a break until ${breakUntil.toDateString()}.`,
    };
  }

  // The line you're calling against, from whichever floor this is.
  let basis: number | null = null;
  if (onOg) {
    const shoe = await prisma.catalogShoe.findUnique({
      where: { id: input.shoeId },
      select: { marketPriceCents: true, ebayNewCents: true },
    });
    if (!shoe) return { ok: false, error: "That pair isn't on the board." };
    basis = marketPrice(shoe);
  } else {
    // A one-of-one's market read is the artist's ask, or the last sale if
    // it has one — the same numbers the customs board already shows.
    const piece = await prisma.submission.findFirst({
      where: { id: input.submissionId, status: "APPROVED" },
      select: {
        askingPriceCents: true,
        sales: { where: { status: "CONFIRMED" }, orderBy: { soldAt: "desc" }, take: 1, select: { priceCents: true } },
      },
    });
    if (!piece) return { ok: false, error: "That piece isn't on the board." };
    basis = piece.askingPriceCents || piece.sales[0]?.priceCents || null;
  }
  if (!basis) return { ok: false, error: "No price on that one yet — nothing to call against." };

  const existing = await prisma.prediction.findFirst({
    where: {
      userId: input.userId,
      ...(onOg ? { shoeId: input.shoeId } : { submissionId: input.submissionId }),
      horizonDays: horizon,
      status: "OPEN",
    },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "You already have an open call on this one at that window." };

  if (input.kind === "DIRECTION" && input.direction !== "UP" && input.direction !== "DOWN") {
    return { ok: false, error: "Call it up or down." };
  }
  if (input.kind === "PRICE") {
    const c = input.predictedCents ?? 0;
    if (!Number.isFinite(c) || c <= 0) return { ok: false, error: "Give a real price." };
    if (c > 5_000_000_00) return { ok: false, error: "That price isn't realistic." };
  }

  const stake = STAKES.includes((input.stakeCredits ?? 0) as (typeof STAKES)[number])
    ? input.stakeCredits!
    : 0;

  // One movement through the ledger: balance and entry written together,
  // self-exclusion and the daily limit checked on the way in. Nothing here
  // can leave the balance and the record disagreeing.
  if (stake > 0) {
    const { postCredits } = await import("./ledger");
    const paid = await postCredits({
      userId: input.userId,
      delta: -stake,
      reason: "call-stake",
    });
    if (!paid.ok) {
      return {
        ok: false,
        error:
          paid.reason === "insufficient"
            ? "Not enough credits for that stake."
            : paid.detail,
      };
    }
  }

  try {
    await prisma.prediction.create({
      data: {
        userId: input.userId,
        shoeId: onOg ? input.shoeId : null,
        submissionId: onCustom ? input.submissionId : null,
        side: onOg ? "OG" : "CUSTOM",
        stakeCredits: stake,
        kind: input.kind,
        horizonDays: horizon,
        basisCents: basis,
        direction: input.kind === "DIRECTION" ? input.direction : null,
        predictedCents: input.kind === "PRICE" ? input.predictedCents : null,
        resolveAt: new Date(Date.now() + horizon * DAY),
      },
    });
  } catch {
    // Never keep somebody's stake for a call that didn't get written. The
    // refund bypasses play limits: a limit governs risking credits, never
    // getting your own back.
    if (stake > 0) {
      const { postCredits } = await import("./ledger");
      await postCredits({
        userId: input.userId,
        delta: stake,
        reason: "call-stake-refund",
        bypassLimits: true,
      });
    }
    return { ok: false, error: "Couldn't place that call — your credits weren't touched." };
  }

  return {
    ok: true,
    note: stake > 0 ? `${stake} credits staked.` : "Called with nothing at risk.",
  };
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
    include: {
      shoe: { select: { marketPriceCents: true, ebayNewCents: true } },
      submission: {
        select: {
          askingPriceCents: true,
          sales: { where: { status: "CONFIRMED" }, orderBy: { soldAt: "desc" }, take: 1, select: { priceCents: true } },
        },
      },
    },
  });
  if (due.length === 0) return { settled: 0, voided: 0, pointsAwarded: 0 };

  // Crowd split per (shoe, horizon) so contrarian calls can be identified.
  const groups = new Map<string, { up: number; down: number }>();
  const groupKey = (p: { shoeId: string | null; submissionId: string | null; horizonDays: number }) =>
    `${p.shoeId ?? p.submissionId}:${p.horizonDays}`;
  for (const p of due) {
    if (p.kind !== "DIRECTION") continue;
    const k = groupKey(p);
    const g = groups.get(k) ?? { up: 0, down: 0 };
    if (p.direction === "UP") g.up++;
    else g.down++;
    groups.set(k, g);
  }

  let settled = 0, voided = 0, pointsAwarded = 0;

  for (const p of due) {
    // Whichever floor this call was made on, read that floor's price.
    const actual = p.shoe
      ? marketPrice(p.shoe)
      : p.submission
        ? p.submission.askingPriceCents || p.submission.sales[0]?.priceCents || null
        : null;

    // No reading to settle against — void it. Never guess someone's record,
    // and hand the stake straight back: a gap in our data must never cost
    // somebody credits they staked in good faith.
    if (!actual) {
      await prisma.prediction.update({
        where: { id: p.id },
        data: { status: "VOID", settledAt: new Date(), payoutCredits: p.stakeCredits },
      }).catch(() => {});
      if (p.stakeCredits > 0) {
        const { postCredits } = await import("./ledger");
        // Keyed on the call: a settlement pass that retries after a timeout
        // loses the race at the database rather than refunding twice.
        await postCredits({
          userId: p.userId,
          delta: p.stakeCredits,
          reason: "call-void-refund",
          idempotencyKey: `void:${p.id}`,
          bypassLimits: true,
        });
      }
      voided++;
      continue;
    }

    let correct = false;
    let points = 0;
    let minority = false;

    if (p.kind === "DIRECTION") {
      const moved = actual - p.basisCents;
      const wentUp = moved > 0;
      // A flat market resolves against both sides — no free points for noise.
      correct = moved !== 0 && ((p.direction === "UP" && wentUp) || (p.direction === "DOWN" && !wentUp));
      if (correct) {
        const g = groups.get(groupKey(p)) ?? { up: 0, down: 0 };
        const mySide = p.direction === "UP" ? g.up : g.down;
        const otherSide = p.direction === "UP" ? g.down : g.up;
        minority = mySide < otherSide;
        points = scoreDirection(minority);
      }
    } else {
      points = scorePrice(p.predictedCents ?? 0, actual);
      correct = points > 0;
    }

    // Stake back plus winnings on a hit; nothing on a miss.
    const payout = payoutFor(p.stakeCredits, p.kind as "DIRECTION" | "PRICE", points, minority);

    await prisma.prediction.update({
      where: { id: p.id },
      data: {
        status: "SETTLED",
        actualCents: actual,
        correct,
        points,
        payoutCredits: payout,
        settledAt: new Date(),
      },
    }).catch(() => {});

    if (points > 0) {
      // Two separate credit events on a win: the staked payout, and the
      // small standing reward for being right that a no-stake call also
      // earns. Kept apart so the ledger reads honestly.
      const { postCredits } = await import("./ledger");
      if (payout > 0) {
        await postCredits({
          userId: p.userId,
          delta: payout,
          reason: "call-payout",
          idempotencyKey: `payout:${p.id}`,
          bypassLimits: true,
        });
      }
      await postCredits({
        userId: p.userId,
        delta: Math.max(1, Math.round(points / 10)),
        reason: "prediction",
        idempotencyKey: `points:${p.id}`,
        bypassLimits: true,
      });
      pointsAwarded += points;
    }

    // One of the four alerts we promised: your call settled. Failure here
    // must never roll back a settlement, so it's fire-and-forget.
    const { pushTo } = await import("./push");
    pushTo(p.userId, {
      title: correct ? `Your call landed — +${points}` : "Your call settled",
      body: `${p.kind === "DIRECTION" ? "Direction" : "Price"} call closed at $${Math.round(actual / 100)}.`,
      url: "/predict",
      tag: `call-${p.id}`,
    }).catch(() => {});
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

export type SlateLane = "FRESH" | "MOVER" | "BLUE_CHIP";

const SELECT = {
  id: true, sku: true, name: true, brand: true, imageUrl: true,
  marketPriceCents: true, ebayNewCents: true, retailPriceCents: true, releaseDate: true,
} as const;

const PRICED = { OR: [{ marketPriceCents: { gt: 0 } }, { ebayNewCents: { gt: 0 } }] };

/**
 * The slate. Three lanes rather than one, so the board doesn't read as
 * "the newest 18" every single day:
 *
 *  - FRESH     — just released, where nobody has a settled read yet
 *  - MOVER     — furthest from retail, so the most volatile to call
 *  - BLUE_CHIP — the expensive end, where being right is hardest
 *
 * Pairs with a photo come first because a board of blank tiles is a board
 * nobody plays, but a missing photo never hides an otherwise callable pair —
 * if the illustrated pool comes up short we backfill from the priced pool
 * rather than serve a half-empty board.
 */
export async function getCallSlate(limit = 18) {
  const per = Math.max(4, Math.ceil(limit / 3));

  const [fresh, expensive, spread] = await Promise.all([
    prisma.catalogShoe.findMany({
      where: PRICED,
      orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }],
      take: per * 3,
      select: SELECT,
    }),
    prisma.catalogShoe.findMany({
      where: PRICED,
      orderBy: [{ marketPriceCents: { sort: "desc", nulls: "last" } }],
      take: per * 3,
      select: SELECT,
    }),
    // Widest retail-to-resale gap: computed in JS because the premium is a
    // ratio of two columns, which Prisma can't order on directly.
    prisma.catalogShoe.findMany({
      where: { ...PRICED, retailPriceCents: { gt: 0 } },
      orderBy: [{ marketPriceCents: "desc" }],
      take: 400,
      select: SELECT,
    }),
  ]);

  const movers = [...spread]
    .sort((a, b) => {
      const gap = (s: (typeof spread)[number]) =>
        Math.abs(((marketPrice(s) ?? 0) - (s.retailPriceCents ?? 0)) / (s.retailPriceCents || 1));
      return gap(b) - gap(a);
    })
    .slice(0, per * 3);

  const lanes: [SlateLane, typeof fresh][] = [
    ["FRESH", fresh],
    ["MOVER", movers],
    ["BLUE_CHIP", expensive],
  ];

  const picked = new Map<string, { lane: SlateLane; shoe: (typeof fresh)[number] }>();
  // Two passes: illustrated pairs claim their slots first, then anything
  // priced backfills so the board fills even on a thin catalog.
  for (const illustratedOnly of [true, false]) {
    for (const [lane, pool] of lanes) {
      let taken = 0;
      for (const s of pool) {
        if (picked.size >= limit) break;
        if (taken >= per) break;
        if (picked.has(s.id)) continue;
        if (illustratedOnly && !s.imageUrl) continue;
        picked.set(s.id, { lane, shoe: s });
        taken++;
      }
    }
    if (picked.size >= limit) break;
  }

  return [...picked.values()].map(({ lane, shoe: s }) => ({
    id: s.id,
    sku: s.sku,
    name: s.name,
    brand: s.brand,
    imageUrl: s.imageUrl,
    lane,
    lastCents: marketPrice(s) ?? 0,
    retailCents: s.retailPriceCents,
    releaseDate: s.releaseDate,
  }));
}
