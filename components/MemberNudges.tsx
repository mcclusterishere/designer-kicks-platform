import Link from "next/link";
import type { Nudge } from "@/lib/nudges";

/**
 * The "unfinished business" strip: a scrollable row of open loops the
 * member left behind — battles to judge, a live quiz run, offers
 * waiting, a piece that just won. Renders nothing when they're all
 * caught up, so it never nags an empty state.
 */
export default function MemberNudges({ nudges }: { nudges: Nudge[] }) {
  if (nudges.length === 0) return null;
  return (
    <div className="border-b border-edge bg-panel/40">
      <div className="no-scrollbar mx-auto flex max-w-6xl gap-2.5 overflow-x-auto px-4 py-3">
        {nudges.map((n) => (
          <Link
            key={n.label}
            href={n.href}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              n.hot
                ? "border-volt/60 bg-volt/10 text-white hover:bg-volt/20"
                : "border-edge bg-surface text-smoke hover:border-volt hover:text-white"
            }`}
          >
            <span aria-hidden>{n.emoji}</span>
            {n.label}
            <span aria-hidden className="text-volt">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
