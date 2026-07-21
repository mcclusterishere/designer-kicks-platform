import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AdPlayer from "@/components/AdPlayer";
import {
  DK_VARIANTS,
  getDkVariant,
  WHAT_IT_IS,
  AUDIENCE_BENEFITS,
} from "../variants";

/**
 * One landing page per ad creative. Ad traffic lands here with
 * ?utm_content={slug}; the video the person just watched in-feed plays
 * again at the top so the page reads as a continuation of the ad, and
 * every section ends in a CTA. Kept out of search indexes — these are
 * paid-traffic pages, not content.
 */

export function generateStaticParams() {
  return DK_VARIANTS.map((v) => ({ variant: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ variant: string }>;
}): Promise<Metadata> {
  const v = getDkVariant((await params).variant);
  if (!v) return {};
  return {
    title: `${v.headline} | Designer Kicks × The Heat Chart`,
    description: v.sub,
    robots: { index: false, follow: false },
  };
}

export default async function DkLandingPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const v = getDkVariant((await params).variant);
  if (!v) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="grid items-start gap-8 md:grid-cols-2">
        {/* The creative, playable beat by beat — tap a moment, the video
            jumps there, and the copy below narrates what's on screen */}
        <div>
          <AdPlayer src={v.video} poster={v.poster ?? undefined} beats={v.beats} />
        </div>

        {/* The pitch */}
        <div className="md:sticky md:top-20">
          <p className="tag text-heat">Designer Kicks × The Heat Chart</p>
          <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
            {v.headline.split(v.accent).map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span className="text-gradient-volt">{v.accent}</span>
                )}
              </span>
            ))}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-smoke">{v.sub}</p>

          <div className="mt-6 grid gap-2">
            <Link
              href={v.primary.href}
              className="btn-hard block rounded-xl py-4 text-center tag font-bold"
            >
              {v.primary.label}
            </Link>
            {v.secondary.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="block rounded-xl border border-edge py-3.5 text-center tag text-white transition hover:border-volt"
              >
                {s.label}
              </Link>
            ))}
          </div>

          <p className="mt-6 text-sm leading-relaxed text-smoke/80">
            {WHAT_IT_IS}
          </p>
        </div>
      </div>

      {/* What's in it for each audience — every row ends in an actionable */}
      <div className="mt-12 grid gap-3 sm:grid-cols-3">
        {AUDIENCE_BENEFITS.map((b) => (
          <div
            key={b.who}
            className="flex flex-col rounded-2xl border border-edge bg-surface p-5"
          >
            <p className="tag text-volt">{b.who}</p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-smoke">
              {b.line}
            </p>
            <Link
              href={b.cta.href}
              className="tag mt-4 inline-block text-volt underline underline-offset-4"
            >
              {b.cta.label} →
            </Link>
          </div>
        ))}
      </div>

      {/* The rebrand, stated plainly */}
      <div className="mt-10 rounded-xl border border-heat/40 bg-heat/5 p-5">
        <h2 className="display text-xl text-white">Why the new name?</h2>
        <p className="mt-2 text-sm leading-relaxed text-smoke">
          Designer Kicks started as a page about custom sneakers. It grew
          into a league that needed a scoreboard — battles, rankings, and a
          real market. That&apos;s The Heat Chart. Same people, same culture,
          bigger arena.{" "}
          <Link href="/story" className="text-volt underline">
            The full story →
          </Link>
        </p>
      </div>

      {/* Closer */}
      <div className="mt-10 rounded-2xl border border-edge bg-surface p-8 text-center">
        <h2 className="display text-3xl text-white">
          Free to join. <span className="text-gradient-volt">Live now.</span>
        </h2>
        <div className="mx-auto mt-5 grid max-w-sm gap-2">
          <Link
            href={`/register?ref=dk-${v.slug}`}
            className="btn-hard block rounded-xl py-4 tag font-bold"
          >
            Create Free Account
          </Link>
          <Link
            href={v.primary.href}
            className="block rounded-xl border border-edge py-3.5 tag text-white transition hover:border-volt"
          >
            {v.primary.label}
          </Link>
        </div>
      </div>

      {/* Mobile: the primary action rides above the tab bar the whole scroll */}
      <div
        className="fixed inset-x-0 z-40 px-4 md:hidden"
        style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }}
      >
        <Link
          href={v.primary.href}
          className="btn-hard mx-auto block max-w-sm rounded-full py-3.5 text-center tag font-bold shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
        >
          {v.primary.label}
        </Link>
      </div>
    </div>
  );
}
