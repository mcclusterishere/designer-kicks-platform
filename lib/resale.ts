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
export const RESALE_PLATFORM_FEE_PCT = 9;

export function resaleSplitLabel(): string {
  return `${RESALE_ARTIST_ROYALTY_PCT}% artist royalty + ${RESALE_PLATFORM_FEE_PCT}% platform fee`;
}
