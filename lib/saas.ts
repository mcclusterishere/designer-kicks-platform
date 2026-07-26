import { prisma } from "./db";

/**
 * The subscription business, measured honestly.
 *
 * These are the numbers an investor asks for, which is exactly why they
 * have to be computed conservatively. Every one of them has a flattering
 * version and a true version:
 *
 *   - MRR counts only artists whose access is actually live. A cancelled
 *     subscriber still inside their paid period is NOT recurring revenue;
 *     that money already arrived and is leaving.
 *   - Annual plans are divided by twelve rather than booked as a month.
 *   - Churn is measured against the cohort that could have churned, not
 *     against total signups, which always flatters.
 *   - Activation is counted separately from signup, because a roster of
 *     pre-loaded pages nobody has claimed is not a user base.
 *
 * The last one matters most right now: a page created by us for an artist
 * who has never logged in is a lead, not a customer, and any dashboard
 * that blurs the two will tell a founder they have twenty-four users when
 * they have three.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Monthly value of one subscription, normalised across intervals. */
export function monthlyValueCents(priceCents: number | null, interval: string | null): number {
  if (!priceCents || priceCents <= 0) return 0;
  if (interval === "year") return Math.round(priceCents / 12);
  return priceCents;
}

export type SaasMetrics = {
  /** Artist pages that exist at all — including ones we created for them. */
  pages: number;
  /** Pages someone has actually logged into. The real denominator. */
  claimed: number;
  /** Claimed AND has posted work. The first honest sign of a user. */
  active: number;
  claimRatePct: number;
  /** Artists paying real money. Founding seats are NOT in here. */
  paying: number;
  /**
   * Founding 100 seats in use — Pro, free, no card.
   *
   * Deliberately its own number rather than folded into `paying`. They
   * are a live, entitled, engaged cohort and that is worth knowing, but
   * counting them as customers would report a hundred subscribers against
   * zero MRR, an ARPU of nothing, and a conversion rate of 100% — a
   * dashboard that flatters in three places at once and is wrong in all
   * three. What they actually are is the answer to "will artists use the
   * business tools at all", which is a different and earlier question
   * than "will they pay for them".
   */
  founding: number;
  mrrCents: number;
  arpuCents: number;
  /** Paid but in trouble — a failed card, still retrying. */
  atRisk: number;
  /** Cancelled, still inside the period they paid for. */
  windingDown: number;
  /** Free → paid, among claimed accounts only. */
  conversionPct: number;
  /** Cancellations in the last 30 days over who was paying 30 days ago. */
  churnPct: number;
  /** MRR × 12. Labelled as the projection it is, never as revenue. */
  runRateCents: number;
};

export async function saasMetrics(now: Date = new Date()): Promise<SaasMetrics> {
  const [pages, claimed, active, subs] = await Promise.all([
    prisma.artistProfile.count({ where: { status: "APPROVED" } }),
    prisma.artistProfile.count({
      where: {
        status: "APPROVED",
        user: { OR: [{ passwordHash: { not: null } }, { accounts: { some: {} } }] },
      },
    }),
    prisma.artistProfile.count({
      where: {
        status: "APPROVED",
        user: { OR: [{ passwordHash: { not: null } }, { accounts: { some: {} } }] },
        submissions: { some: { status: "APPROVED" } },
      },
    }),
    prisma.artistProfile.findMany({
      where: { plan: "PRO" },
      select: {
        planStatus: true,
        planPriceCents: true,
        planInterval: true,
        paidThrough: true,
        firstSubscribedAt: true,
      },
    }),
  ]);

  // Live means access is running AND they haven't cancelled. A cancelled
  // subscriber still inside their period keeps access — that's fair — but
  // their money is not recurring, so it is not in MRR.
  const live = subs.filter(
    (s) =>
      s.planStatus !== "canceled" &&
      (s.paidThrough === null || s.paidThrough.getTime() > now.getTime())
  );
  const windingDown = subs.filter(
    (s) =>
      s.planStatus === "canceled" &&
      s.paidThrough !== null &&
      s.paidThrough.getTime() > now.getTime()
  ).length;

  const mrrCents = live.reduce(
    (t, s) => t + monthlyValueCents(s.planPriceCents, s.planInterval),
    0
  );
  // Founding seats are live entitlements that nobody is paying for, so
  // they belong in their own column and out of every revenue ratio.
  const founding = live.filter((s) => s.planStatus === "founding").length;
  const paying = live.length - founding;

  const thirtyAgo = new Date(now.getTime() - 30 * DAY);
  // Who was paying 30 days ago: anyone who had already subscribed by then
  // and hasn't since been cancelled-and-expired. The denominator is the
  // population that COULD have churned, not everyone who ever signed up.
  const wasPaying = subs.filter(
    (s) => s.firstSubscribedAt !== null && s.firstSubscribedAt < thirtyAgo
  ).length;
  const lostRecently = subs.filter(
    (s) =>
      s.planStatus === "canceled" &&
      s.firstSubscribedAt !== null &&
      s.firstSubscribedAt < thirtyAgo &&
      s.paidThrough !== null &&
      s.paidThrough.getTime() > thirtyAgo.getTime()
  ).length;

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

  return {
    pages,
    claimed,
    active,
    claimRatePct: pct(claimed, pages),
    paying,
    founding,
    mrrCents,
    arpuCents: paying > 0 ? Math.round(mrrCents / paying) : 0,
    atRisk: subs.filter((s) => s.planStatus === "past_due" || s.planStatus === "incomplete").length,
    windingDown,
    conversionPct: pct(paying, claimed),
    churnPct: pct(lostRecently, wasPaying),
    runRateCents: mrrCents * 12,
  };
}

/**
 * How long until the subscription funds a given goal.
 *
 * Built for one specific question — "when can I pay for a blank run" —
 * and deliberately honest about it: it reports never, rather than a
 * fantasy date, when the current MRR can't get there. A plan that only
 * works if growth appears from nowhere isn't a plan.
 */
export function monthsToGoal(
  mrrCents: number,
  goalCents: number,
  netMarginPct = 100
): number | null {
  const keep = (mrrCents * netMarginPct) / 100;
  if (keep <= 0) return null;
  return Math.ceil(goalCents / keep);
}

/**
 * The roster as a funnel, since converting the pages that already exist
 * is cheaper than finding new artists.
 */
export async function claimFunnel() {
  const rows = await prisma.artistProfile.findMany({
    where: { status: "APPROVED" },
    select: {
      slug: true,
      displayName: true,
      plan: true,
      outreachStage: true,
      lastTouchAt: true,
      touchCount: true,
      user: { select: { passwordHash: true, _count: { select: { accounts: true } } } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  return rows.map((r) => ({
    slug: r.slug,
    displayName: r.displayName,
    // Never returns the hash itself — only whether one exists. The public
    // artist page leaked exactly this once; the shape stays a boolean.
    claimed: Boolean(r.user.passwordHash) || r.user._count.accounts > 0,
    paying: r.plan === "PRO",
    pieces: r._count.submissions,
    stage: r.outreachStage,
    touchCount: r.touchCount,
    daysSinceTouch: r.lastTouchAt ? Math.round((now - r.lastTouchAt.getTime()) / DAY) : null,
  }));
}
