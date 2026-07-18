import Link from "next/link";
import { prisma } from "@/lib/db";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { getPublishedArticles } from "@/lib/articles";
import { getActiveGiveaway } from "@/lib/quiz";
import BattleCard from "@/components/BattleCard";
import ProductCard from "@/components/ProductCard";
import ArticleCard from "@/components/ArticleCard";
import HypeTicker from "@/components/HypeTicker";

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

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-edge">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-volt/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-heat/10 blur-3xl" />
        <span aria-hidden className="ghost-word right-[-2rem] top-6 hidden text-[16rem] md:block">
          Heat
        </span>
        <span aria-hidden className="ghost-word bottom-[-3rem] left-[-1rem] hidden text-[11rem] lg:block">
          1 of 1
        </span>
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="tag inline-block -skew-x-6 border-l-4 border-volt bg-surface px-3 py-1.5 text-volt">
            Custom sneaker battles · Est. on Facebook
          </p>
          <h1 className="display mt-5 max-w-3xl text-6xl text-white sm:text-8xl">
            Your customs.
            <br />
            Their votes.
            <br />
            <span className="text-gradient-volt">The Heat List.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-smoke">
            Submit the hardest custom kicks you&apos;ve painted, go head-to-head
            with other artists in vote battles, and let the culture crown the
            winner.
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
              <span className="display text-3xl">🏆</span>
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
              <p className="tag text-heat">🏆 Championship bracket — live now</p>
              <p className="display text-xl text-white sm:text-2xl">{tournament.name}</p>
            </div>
            <span className="rounded-lg bg-heat px-5 py-2.5 tag font-bold text-white glow-heat">
              View Bracket →
            </span>
          </Link>
        )}
        <div className="flex items-end justify-between">
          <div>
            <div className="h-1.5 w-16 -skew-x-12 bg-heat" />
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
            <p className="display text-2xl text-white">The arena is warming up 🔥</p>
            <p className="mx-auto mt-2 max-w-md text-smoke">
              New matchups drop as artists enter.{" "}
              <Link href="/submit" className="text-volt underline">
                Submit your customs
              </Link>{" "}
              and be in the first wave.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {battles.map((b) => (
              <BattleCard
                key={b.id}
                battle={b}
                aVotes={b.votes.filter((v) => v.submissionId === b.subAId).length}
                bVotes={b.votes.filter((v) => v.submissionId === b.subBId).length}
              />
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
                className="card-lift group relative overflow-hidden rounded-xl border border-edge bg-ink"
              >
                <span className="sticker absolute left-3 top-3 z-10 px-2.5 py-1 text-2xl">
                  #{i + 1}
                </span>
                <div className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.imageUrl}
                    alt={entry.title}
                    className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                </div>
                <div className="p-4">
                  <p className="font-bold text-white">{entry.title}</p>
                  <p className="text-sm text-smoke">
                    {entry.artistName} · {entry.wins}W · {entry.totalVotes} votes
                  </p>
                </div>
              </div>
            ))}
            {top3.length === 0 && (
              <p className="col-span-full rounded-xl border border-dashed border-edge bg-ink p-8 text-center text-smoke">
                The chart is blank until the first battle ends — then names live
                here forever. 🔥
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Drop report preview */}
      {articles.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-end justify-between">
            <div>
              <div className="h-1.5 w-16 -skew-x-12 bg-volt" />
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
            {articles.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        </section>
      )}

      {/* Shop preview */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between">
          <div>
            <div className="h-1.5 w-16 -skew-x-12 bg-heat" />
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
    </div>
  );
}
