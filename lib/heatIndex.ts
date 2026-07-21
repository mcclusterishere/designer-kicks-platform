/**
 * The Heat Index (HX) — the proprietary number behind the customs
 * market. Every piece carries a live score that moves with real
 * activity, so the board fluctuates like a market instead of sitting
 * still like a gallery:
 *
 *   votes            +2 each          (attention)
 *   battle wins      +30              (proven in the arena)
 *   championships    +120             (dynasty weight)
 *   ratings          3×(stars − 3)    (5★ pushes up, 1★ drags DOWN)
 *   open bids        +10 + $1/50 bid  (live demand)
 *   confirmed sales  +40 (+60 verified) + $1/50 of the price
 *
 * Value = 100 + all points ever. The delta is the last 7 days of
 * points — the "what's moving this week" arrow. Ratings are the only
 * negative force, which is exactly right: the crowd cooling on a piece
 * is the one thing that should pull its number down.
 */

export type HeatEvent = { at: Date; pts: number };
export type HeatIndexValue = { value: number; weekDelta: number };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function computeHeatIndex(events: HeatEvent[], now: Date = new Date()): HeatIndexValue {
  let total = 0;
  let week = 0;
  const cutoff = now.getTime() - WEEK_MS;
  for (const e of events) {
    total += e.pts;
    if (e.at.getTime() >= cutoff) week += e.pts;
  }
  return { value: Math.max(0, Math.round(100 + total)), weekDelta: Math.round(week) };
}

/** Build the event list from a piece's relations (all timestamped). */
export function pieceHeatEvents(piece: {
  votes?: { createdAt: Date }[];
  battlesWon?: { createdAt: Date }[];
  tournamentsWon?: { createdAt: Date }[];
  ratings?: { stars: number; createdAt: Date }[];
  openOffers?: { amountCents: number; createdAt: Date }[];
  confirmedSales?: { priceCents: number; verified: boolean; soldAt: Date }[];
}): HeatEvent[] {
  const events: HeatEvent[] = [];
  for (const v of piece.votes ?? []) events.push({ at: v.createdAt, pts: 2 });
  for (const b of piece.battlesWon ?? []) events.push({ at: b.createdAt, pts: 30 });
  for (const t of piece.tournamentsWon ?? []) events.push({ at: t.createdAt, pts: 120 });
  for (const r of piece.ratings ?? []) events.push({ at: r.createdAt, pts: 3 * (r.stars - 3) });
  for (const o of piece.openOffers ?? [])
    events.push({ at: o.createdAt, pts: 10 + Math.floor(o.amountCents / 5000) });
  for (const s of piece.confirmedSales ?? [])
    events.push({ at: s.soldAt, pts: (s.verified ? 60 : 40) + Math.floor(s.priceCents / 5000) });
  return events;
}
