import Link from "next/link";
import { DESK_RANKS, type IQBreakdown } from "@/lib/iq";

/**
 * Where you stand on the desk.
 *
 * Market IQ sits beside Culture IQ rather than replacing it, because they
 * measure genuinely different things: one is what you know about the
 * culture, the other is what you understand about the market underneath it.
 * Plenty of people will be strong at one and hopeless at the other, and
 * collapsing them into a single number would hide the interesting part.
 *
 * The ranks are real trading-floor roles, ordered by how much they have to
 * understand, each with the plain sneaker version underneath — so the title
 * means something before you know what it means.
 */
export default function DeskRank({
  iq,
  rank,
}: {
  iq: IQBreakdown;
  rank: { level: number; title: string; blurb: string; toNext: number; next: { title: string } | null };
}) {
  const started = iq.correct + iq.misses + iq.cleared > 0;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="tag text-volt">Market IQ</p>
        <p className="tag text-smoke">
          {started ? (
            <>
              <span className="font-bold text-white">{iq.iq}</span> · {iq.correct} right
            </>
          ) : (
            "not started"
          )}
        </p>
      </div>

      {started ? (
        <>
          <p className="display mt-1 text-2xl text-white">{rank.title}</p>
          <p className="mt-0.5 text-xs text-smoke">{rank.blurb}</p>

          {/* The ladder, with where you are on it. Seeing the rungs above
              is most of the reason to climb. */}
          <ol className="mt-3 flex gap-1" aria-label="Desk ranks">
            {DESK_RANKS.map((r) => (
              <li
                key={r.level}
                title={`${r.title} — ${r.blurb}`}
                className={`h-1.5 flex-1 rounded-full ${
                  r.level <= rank.level ? "bg-volt" : "bg-panel"
                }`}
              />
            ))}
          </ol>

          <p className="tag mt-2 text-smoke">
            {rank.next
              ? `${rank.toNext} more right to make ${rank.next.title}`
              : "Top of the desk — you've cleared every rung."}
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-sm leading-relaxed text-smoke">
          The same market you already read for fun, explained properly — what a bid
          is, what a spread costs you, why the crowd is usually already priced in.
        </p>
      )}

      <Link
        href="/quiz"
        className="mt-3 inline-block rounded-lg border border-edge px-4 py-2 tag font-bold text-white transition hover:border-volt"
      >
        {started ? "Take a run at the desk →" : "Start at the desk →"}
      </Link>
    </div>
  );
}
