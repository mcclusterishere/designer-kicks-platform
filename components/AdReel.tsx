import Link from "next/link";
import { DK_VARIANTS } from "@/app/dk/variants";

/**
 * The reel strip: every campaign video playing in a horizontal swipe
 * row, each one tappable through to its interactive landing page where
 * the ad gets explained beat by beat. This is how the generated assets
 * live INSIDE the site instead of only running as ads — the platform
 * showing itself off in its own feed.
 */
export default function AdReel() {
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <div className="rule w-16" />
          <h2 className="display mt-2 text-3xl text-white sm:text-4xl">
            The league, in <span className="text-heat">six seconds</span>
          </h2>
        </div>
        <Link href="/dk" className="tag text-smoke transition hover:text-volt">
          All reels →
        </Link>
      </div>
      <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
        {DK_VARIANTS.map((v) => (
          <Link
            key={v.slug}
            href={`/dk/${v.slug}`}
            className="group relative w-40 shrink-0 snap-start overflow-hidden rounded-2xl border border-edge bg-black transition hover:border-volt sm:w-44"
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
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
              <p className="tag text-volt">{v.name}</p>
              <p className="tag mt-0.5 text-smoke">Tap for the breakdown →</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
