/**
 * Reconsignment terms — where the platform actually earns.
 *
 * A collector who owns a piece (acquired through a confirmed,
 * admin/evidence-VERIFIED sale — proof the pair is physically theirs)
 * can relist it at their own price. When it moves, the split is on the
 * record: the artist earns a royalty on every resale of their work,
 * and the platform takes its cut — this is the revenue lane, not the
 * 1% primary fee. The royalty is the flywheel: artists get paid every
 * time their piece re-trades, so promoting the resale market IS
 * promoting themselves.
 *
 * No payment rails yet, so the split is recorded on the sale and
 * settled member-to-member; when checkout opens these numbers price it.
 */
export const RESALE_ARTIST_ROYALTY_PCT = 10;
export const RESALE_PLATFORM_FEE_PCT = 10;

/**
 * Half of the platform's cut goes to whoever brought the seller onto the
 * platform, for as long as that member keeps trading. An artist who
 * onboards his own customers therefore earns twice on a resale of his own
 * work: the artist royalty AND half the platform fee.
 */
export const REFERRER_SHARE_OF_PLATFORM_PCT = 50;

/**
 * Stripe's published US card rate. Passed through to the seller rather
 * than absorbed — quoted separately from our fee so nobody is told we
 * charge less than we do, and so the number stays honest if Stripe
 * changes theirs.
 */
export const STRIPE_PCT = 2.9;
export const STRIPE_FLAT_CENTS = 30;

export function stripeFeeCents(amountCents: number): number {
  return Math.round((amountCents * STRIPE_PCT) / 100) + STRIPE_FLAT_CENTS;
}

/** Every cent of a resale, accounted for. Nothing hidden in a rounding. */
export function resaleBreakdown(priceCents: number) {
  const artistRoyalty = Math.round((priceCents * RESALE_ARTIST_ROYALTY_PCT) / 100);
  const platformFee = Math.round((priceCents * RESALE_PLATFORM_FEE_PCT) / 100);
  const stripe = stripeFeeCents(priceCents);
  const referrerShare = Math.round((platformFee * REFERRER_SHARE_OF_PLATFORM_PCT) / 100);
  return {
    priceCents,
    artistRoyalty,
    platformFee,
    // The house keeps what's left of its own fee after the referrer's half.
    platformNet: platformFee - referrerShare,
    referrerShare,
    stripe,
    sellerNet: priceCents - artistRoyalty - platformFee - stripe,
  };
}

export function resaleSplitLabel(): string {
  return `${RESALE_ARTIST_ROYALTY_PCT}% artist royalty + ${RESALE_PLATFORM_FEE_PCT}% platform fee`;
}
