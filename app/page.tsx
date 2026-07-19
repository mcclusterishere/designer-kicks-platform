import Link from "next/link";
import { prisma } from "@/lib/db";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { getPublishedArticles } from "@/lib/articles";
import { getActiveGiveaway } from "@/lib/quiz";
import BattleCard from "@/components/BattleCard";
import ProductCard from "@/components/ProductCard";
import ArticleCard from "@/components/ArticleCard";
import HypeTicker from "@/components/HypeTicker";
import FeedScroller from "@/components/FeedScroller";
import { SHOP_LIVE } from "@/lib/flags";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await finalizeExpiredBattles();

  const [battles, heat, products, articles] = await Promise.all([
    prisma.battle.findMany({
      where: { status: "ACTIVE" },
      orderBy: { endsAt: "asc" },
      take: 4,
      include: { subA: true, subB: true, votes: { select: { submissionId: true } } },
    }),
    getHeatList(),
    prisma.product.findMany({
      where: { featured: true },
      orderBy: { sortOrder: "asc" },
      take: 4,
    }),
    getPublishedArticles(3),
  ]);
  const giveaway = await getActiveGiveaway();
  const tournament = await prisma.tournament.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  const top3 = heat.slice(0, 3);
  // The living cover: whoever is #1 on the chart fronts the site.
  const cover = top3[0] ?? null;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-edge">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-volt/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-heat/10 blur-3xl" />
        {!cover && (
          <span aria-hidden className="ghost-word right-[-2rem] top-6 hidden text-[16rem] md:block">
            Heat
          </span>
        )}
        <span aria-hidden className="ghost-word bottom-[-3rem] left-[-1rem] hidden text-[11rem] lg:block">
          1 of 1
        </span>
        <div
          className={`relative mx-auto max-w-6xl gap-10 px-4 py-16 sm:py-20 ${
            cover ? "grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center" : ""
          }`}
        >
          <div>
            <p className="tag inline-block -skew-x-6 border-l-4 border-volt bg-surface px-3 py-1.5 text-volt">
              Custom sneaker battles · Est. on Facebook
            </p>
            <h1 className="display mt-5 max-w-3xl text-6xl text-white sm:text-7xl">
              Your customs.
              <br />
              Their votes.
              <br />
              <span className="text-gradient-volt">The Heat List.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-smoke">
              Submit the hardest custom kicks you&apos;ve painted, go
              head-to-head with other artists in vote battles, and let the
              culture crown the winner.
            </p>
            <div className="mt-9 flex flex-wrap gap-5">
              <Link
                href="/submit"
                className="btn-hard rounded-lg bg-volt px-7 py-3.5 tag font-bold text-ink"
              >
                Submit Your Customs
              </Link>
              <Link
                href="/battles"
                className="btn-hard-volt rounded-lg border-2 border-white/90 bg-ink px-7 py-3.5 tag font-bold text-white"
              >
                Vote In Battles
              </Link>
            </div>
            <p className="tag mt-8 text-smoke">
              Free to vote · Free to play · 1% seller fee when checkout opens
            </p>
          </div>

          {/* The cover changes whenever the chart does — a real piece, a
              real name, fronting the site like a magazine issue. */}
          {cover && (
            <Link
              href={cover.artistSlug ? `/artists/${cover.artistSlug}` : "/heat-list"}
              className="card-lift group relative mt-4 block overflow-hidden rounded-xl border border-volt/40 bg-panel lg:mt-0"
            >
              <span className="sticker absolute left-4 top-4 z-10 px-2.5 py-1 text-sm">
                This Week&apos;s Cover
              </span>
              <div className="overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover.imageUrl}
                  alt={`${cover.title} by ${cover.artistName} — №1 on The Heat Chart`}
                  className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-5 pt-20">
                <p className="tag text-volt">№1 on the chart</p>
                <p className="display mt-1 text-3xl text-white">{cover.title}</p>
                <p className="mt-1 text-sm text-smoke">
                  by <span className="text-white">{cover.artistName}</span> ·{" "}
                  {cover.totalVotes} votes and counting
                </p>
              </div>
            </Link>
          )}
        </div>
      </section>

      <HypeTicker />

      {/* Giveaway / quiz banner */}
      {giveaway && (
        <section className="border-b border-edge bg-surface">
          <Link
            href="/quiz"
            className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 transition hover:opacity-90"
          >
            <div className="flex items-center gap-4">
              <span className="display text-3xl text-volt">No.1</span>
              <div>
                <p className="tag text-heat">Live giveaway — play trivia to enter</p>
                <p className="display text-xl text-white sm:text-2xl">
                  Win: <span className="text-volt">{giveaway.prize}</span>
                </p>
              </div>
            </div>
            <span className="rounded-lg bg-heat px-6 py-3 tag font-bold text-white glow-heat">
              Take The Heat Check →
            </span>
          </Link>
        </section>
      )}

      {/* Live battles */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        {tournament && (
          <Link
            href={`/tournaments/${tournament.slug}`}
            className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-heat/60 bg-surface p-4 transition hover:border-heat"
          >
            <div>
              <p className="tag text-heat">Championship bracket — live now</p>
              <p className="display text-xl text-white sm:text-2xl">{tournament.name}</p>
            </div>
            <span className="rounded-lg bg-heat px-5 py-2.5 tag font-bold text-white glow-heat">
              View Bracket →
            </span>
          </Link>
        )}
        <div className="flex items-end justify-between">
          <div>
            <div className="rule w-16" />
            <h2 className="display mt-2 text-3xl text-white sm:text-4xl">
              Live <span className="text-heat">Battles</span>
            </h2>
          </div>
          <Link
            href="/battles"
            className="tag rounded-full border border-edge px-4 py-2 text-smoke transition hover:border-heat hover:text-white"
          >
            All battles →
          </Link>
        </div>
        {battles.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-edge bg-surface p-10 text-center">
            <p className="display text-2xl text-white">The arena is warming up</p>
            <p className="mx-auto mt-2 max-w-md text-smoke">
              New matchups drop as artists enter.{" "}
              <Link href="/submit" className="text-volt underline">
                Submit your customs
              </Link>{" "}
              and be in the first wave.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {battles.map((b, i) => (
              <div
                key={b.id}
                className={i === 0 && battles.length > 1 ? "relative md:col-span-2" : "relative"}
              >
                {i === 0 && battles.length > 1 && (
                  <span className="sticker absolute -top-3.5 left-5 z-20 px-2.5 py-1 text-sm">
                    Main Event
                  </span>
                )}
                <BattleCard
                  battle={b}
                  aVotes={b.votes.filter((v) => v.submissionId === b.subAId).length}
                  bVotes={b.votes.filter((v) => v.submissionId === b.subBId).length}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Heat list preview */}
      <section className="border-y border-edge bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-end justify-between">
            <div>
              <div className="h-1.5 w-16 -skew-x-12 bg-volt" />
              <h2 className="display mt-2 text-3xl text-white sm:text-4xl">
                The <span className="text-volt">Heat List</span>
              </h2>
            </div>
            <Link
              href="/heat-list"
              className="tag rounded-full border border-edge px-4 py-2 text-smoke transition hover:border-volt hover:text-white"
            >
              Full rankings →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {top3.map((entry, i) => (
              <div
                key={entry.id}
                className={`card-lift group relative overflow-hidden rounded-xl border bg-ink ${
                  i === 0 ? "border-volt/40 sm:col-span-2 sm:row-span-2" : "border-edge"
                }`}
              >
                <span
                  className={`sticker absolute left-3 top-3 z-10 px-2.5 py-1 ${
                    i === 0 ? "text-3xl" : "text-xl"
                  }`}
                >
                  #{i + 1}
                </span>
                {i === 0 && (
                  <span className="tag absolute right-3 top-4 z-10 rounded border border-volt/50 bg-ink/85 px-2.5 py-1.5 text-volt">
                    The one to beat
                  </span>
                )}
                <div className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.imageUrl}
                    alt={entry.title}
                    className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                </div>
                <div className="p-4">
                  <p className={`text-white ${i === 0 ? "display text-2xl" : "font-bold"}`}>
                    {entry.title}
                  </p>
                  <p className="text-sm text-smoke">
                    {entry.artistName} · {entry.wins}W · {entry.totalVotes} votes
                  </p>
                </div>
              </div>
            ))}
            {top3.length === 0 && (
              <p className="col-span-full rounded-xl border border-dashed border-edge bg-ink p-8 text-center text-smoke">
                The chart is blank until the first battle ends — then names live
                here forever.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Drop report preview */}
      {articles.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          {/* Editorial rhythm: this section runs right-aligned with a lead story */}
          <div className="flex flex-row-reverse items-end justify-between">
            <div className="text-right">
              <div className="ml-auto h-1.5 w-16 skew-x-12 bg-volt" />
              <h2 className="display mt-2 text-3xl text-white sm:text-4xl">
                Drop <span className="text-volt">Report</span>
              </h2>
            </div>
            <Link
              href="/news"
              className="tag rounded-full border border-edge px-4 py-2 text-smoke transition hover:border-volt hover:text-white"
            >
              All news →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {articles[0] && (
              <div className="sm:col-span-2">
                <ArticleCard article={articles[0]} large />
              </div>
            )}
            {articles.slice(1).map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        </section>
      )}

      {/* Founder's note — a person runs this, and it shows */}
      <section className="border-y border-edge bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <div className="stripes mx-auto h-px w-28" />
          <blockquote
            className="mt-7 text-2xl italic leading-snug text-white sm:text-3xl"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            &ldquo;This started as a Facebook page and a camera roll full of
            customs nobody was ranking. Now the culture keeps the score.&rdquo;
          </blockquote>
          <p className="tag mt-5 text-smoke">
            — Matt · Founder
          </p>
          <Link href="/story" className="tag mt-3 inline-block text-volt underline underline-offset-4">
            Read our story →
          </Link>
        </div>
      </section>

      {/* Shop preview — stashed behind SHOP_LIVE until it's fully curated */}
      {SHOP_LIVE && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-end justify-between">
            <div>
              <div className="rule w-16" />
              <h2 className="display mt-2 text-3xl text-white sm:text-4xl">
                Gear <span className="text-heat">&amp; Heat</span>
              </h2>
            </div>
            <Link
              href="/shop"
              className="tag rounded-full border border-edge px-4 py-2 text-smoke transition hover:border-heat hover:text-white"
            >
              Full shop →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* The Feed — the infinite scroll machine */}
      <section className="border-t border-edge">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="mx-auto max-w-xl">
            <div className="rule w-16" />
            <h2 className="display mt-2 text-3xl text-white sm:text-4xl">The Feed</h2>
            <p className="mt-1 text-sm text-smoke">
              Everything moving on the chart — live battles, fresh customs,
              drops, and word from the house. Sign in and it learns your taste.
            </p>
          </div>
          <div className="mt-6">
            <FeedScroller />
          </div>
        </div>
      </section>
    </div>
  );
}
