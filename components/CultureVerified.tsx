/**
 * The brand's authentication mark — a machined stamp, not a decoration.
 * Worn by artists who claimed and verified their profile (a real person
 * behind the work), and by the footer as the house seal. Never fake
 * provenance: render it only where verification actually happened.
 */
export default function CultureVerified({
  detail,
  compact = false,
}: {
  /** Right-hand slot: "1 OF 1", a year, a division — optional. */
  detail?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className="tag inline-flex items-center gap-1.5 rounded border border-volt/60 px-2 py-1 font-bold text-volt">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-volt" />
        Culture Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded border border-white/25">
      <span className="tag flex items-center gap-1.5 border-r border-white/25 bg-white/[0.04] px-2.5 py-1.5 font-bold text-white">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-volt" />
        Culture Verified
      </span>
      {detail && (
        <span className="tag flex items-center px-2.5 py-1.5 font-bold text-volt">{detail}</span>
      )}
    </span>
  );
}
