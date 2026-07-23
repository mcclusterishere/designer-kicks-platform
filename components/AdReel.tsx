import Link from "next/link";
import { DK_VARIANTS } from "@/app/dk/variants";

/**
 * The "league, in six seconds" strip. Curated down to THREE hero clips
 * — the whole loop in one glance: the Market, the Arena, the Heat List.
 * Six videos was a wall; three is a story. Captions are set bold and
 * high-contrast (not the old hairline mono tag) so the copy reads at a
 * glance on a phone in daylight.
 */
const REEL_SLUGS = ["market", "arena", "heatlist"] as const;

const REEL = REEL_SLUGS.map((s) => DK_VARIANTS.find((v) => v.slug === s)!).filter(
  Boolean
);

export default function AdReel() {
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <div className="rule w-16" />
          <h2 className="display mt-2 text-3xl text-white sm:text-4xl">
            The league, in <span className="text-heat">six seconds</span>
          </h2>
          <p className="mt-2 max-w-md text-sm font-medium text-smoke">
            Three taps through the whole thing — the market, the arena, the rankings.
          </p>
        </div>
      </div>
      <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
        {REEL.map((v) => (
          <Link
            key={v.slug}
            href={`/dk/${v.slug}`}
            className="group relative w-56 shrink-0 snap-start overflow-hidden rounded-2xl border border-edge bg-black transition hover:border-volt sm:w-64"
          >
            <video
              src={v.video}
              poster={v.poster ?? undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="aspect-[9/16] w-full object-cover opacity-90 transition group-hover:opacity-100"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent p-4 pt-10">
              <p className="display text-base leading-tight text-white">{v.name}</p>
              <p className="mt-1.5 text-sm font-bold text-heat">Tap in →</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
