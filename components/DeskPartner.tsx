/**
 * The Heat Chart × Street Credit Bureau.
 *
 * The instrument rungs of the desk (Product Specialist and up) are taught
 * from Street Credit Bureau's instrument taxonomy — 15 categories and 121
 * instruments, with the cross-instrument distinctions that make a warrant
 * legibly different from a call. We teach the part a resale audience can
 * actually reach; the full library is their product.
 *
 * Credit where the work came from, and a door for anyone who wants the
 * whole thing rather than the reachable slice.
 *
 * The outbound link is deliberately gated on NEXT_PUBLIC_PARTNER_URL. With
 * no URL configured the card still gives the attribution but renders no
 * link — pointing people at a destination that isn't finished would spend
 * the credibility this is meant to build. Set the variable when it's ready
 * and the card becomes a door.
 */
export default function DeskPartner({
  href,
  compact = false,
}: {
  href: string | null;
  compact?: boolean;
}) {
  const body = (
    <>
      <p className="tag text-heat">In partnership with</p>
      <p className="display mt-0.5 text-xl text-white">Street Credit Bureau</p>
      <p className="mt-1.5 text-xs leading-relaxed text-smoke">
        The instrument rungs of the desk are taught from Street Credit Bureau&apos;s
        instrument library — 15 categories, 121 instruments, and the distinctions
        between them. We teach the ones this market actually touches.
        {href ? " The full library is theirs." : " The full library is theirs, and it's on its way."}
      </p>
    </>
  );

  if (!href) {
    return (
      <div className={`rounded-xl border border-edge bg-surface ${compact ? "p-3" : "p-4"}`}>
        {body}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-xl border border-edge bg-surface transition hover:border-heat ${
        compact ? "p-3" : "p-4"
      }`}
    >
      {body}
      <span className="tag mt-2 inline-block text-heat">Open the full library →</span>
    </a>
  );
}

/** One place to read the partner URL, so every surface agrees. */
export function partnerUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_PARTNER_URL?.trim();
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}
