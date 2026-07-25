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
 * There is no separate referral cut, and that is deliberate.
 *
 * The first sketch gave whoever onboarded a member half the platform's fee
 * on everything they ever sold. The royalty already does that job better:
 * an artist earns on every resale of his own work, forever, without anyone
 * having to track who introduced whom. Dropping the referral layer removes
 * a whole category of argument — double attribution, a member onboarded by
 * two people, what happens when the referrer leaves — for a mechanic that
 * pays the maker for making rather than for recruiting.
 *
 * So the split is three numbers and they add to a hundred:
 *   10% artist royalty · 10% platform · 80% seller, less Stripe.
 */

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

/**
 * Every cent of a resale, accounted for. Nothing hidden in a rounding.
 *
 * The seller's share is computed as the remainder rather than as its own
 * percentage, so the parts always sum to exactly the price. Taking 80% and
 * hoping it lines up leaves a stray cent somewhere, and a stray cent in a
 * payout is a support ticket.
 */
export function resaleBreakdown(priceCents: number) {
  const artistRoyalty = Math.round((priceCents * RESALE_ARTIST_ROYALTY_PCT) / 100);
  const platformFee = Math.round((priceCents * RESALE_PLATFORM_FEE_PCT) / 100);
  const stripe = stripeFeeCents(priceCents);
  return {
    priceCents,
    artistRoyalty,
    platformFee,
    stripe,
    sellerNet: priceCents - artistRoyalty - platformFee - stripe,
  };
}

/**
 * The same numbers as a sentence somebody can check.
 *
 * Every seller sees this before they list. A resale market where people
 * discover the fee after the sale is a resale market people use once.
 */
export function resaleQuote(priceCents: number): string {
  const b = resaleBreakdown(priceCents);
  const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
  return (
    `On ${usd(b.priceCents)}: you keep ${usd(b.sellerNet)}. ` +
    `${usd(b.artistRoyalty)} royalty to the maker, ` +
    `${usd(b.platformFee)} platform, ${usd(b.stripe)} card processing.`
  );
}

export function resaleSplitLabel(): string {
  return `${RESALE_ARTIST_ROYALTY_PCT}% artist royalty + ${RESALE_PLATFORM_FEE_PCT}% platform fee`;
}
