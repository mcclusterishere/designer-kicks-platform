import Link from "next/link";
import { getEditorsPick } from "@/lib/editorsPick";

/**
 * The Editor's Pick spotlight — a magazine "house designer" feature that
 * anoints one maker by editorial choice, deliberately set apart from the
 * vote-driven Heat List. Champagne/heat treatment (not the volt ranking
 * red) so it reads as an editors' statement, not a leaderboard. Renders
 * nothing when nobody's anointed.
 */
export default async function EditorsPick() {
  const pick = await getEditorsPick();
  if (!pick) return null;

  return (
    <section className="border-y border-heat/25 bg-gradient-to-b from-heat/[0.06] to-transparent">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <div
          className={`grid items-center gap-8 ${
            pick.heroImage ? "lg:grid-cols-[0.95fr_1.05fr]" : "max-w-2xl"
          }`}
        >
          {/* The work — his hero piece, framed like a cover shot */}
          {pick.heroImage && (
            <Link
              href={`/artists/${pick.slug}`}
              className="card-lift group relative order-1 block overflow-hidden rounded-2xl border border-heat/40 bg-panel lg:order-none"
            >
              <img
                src={pick.heroImage}
                alt={`${pick.displayName} — Editor's Pick`}
                className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <span className="absolute left-4 top-4 rounded-full bg-heat px-3 py-1 tag font-bold text-ink">
                ★ Editor's Pick
              </span>
            </Link>
          )}

          <div>
            <p className="tag text-heat">Editor's Pick</p>
            <h2 className="display mt-3 text-4xl text-white sm:text-5xl">
              {pick.displayName}
            </h2>
            {pick.city && (
              <p className="mt-1 text-sm font-semibold text-smoke">{pick.city}</p>
            )}
            {pick.note && (
              <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-smoke">
                {pick.note}
              </p>
            )}
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href={`/artists/${pick.slug}`}
                className="rounded-lg bg-heat px-7 py-3.5 tag font-bold text-ink glow-heat transition hover:brightness-110"
              >
                See The Work →
              </Link>
              <Link
                href="/giveaway"
                className="rounded-lg border-2 border-heat/60 px-6 py-3 tag font-bold text-heat transition hover:bg-heat/10"
              >
                Win His Custom Vest
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
