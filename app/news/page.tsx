import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedArticles, siteUrl } from "@/lib/articles";
import ArticleCard from "@/components/ArticleCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sneaker Drop News & Release Dates — The Heat Chart",
  description:
    "Upcoming sneaker release dates, raffle links, and drop intel — Jordan retros, Dunks, collabs, and the customs community's take on every major release.",
  alternates: {
    canonical: `${siteUrl()}/news`,
    types: { "application/rss+xml": `${siteUrl()}/news/feed.xml` },
  },
  openGraph: {
    title: "Sneaker Drop News & Release Dates — The Heat Chart",
    description:
      "Upcoming sneaker release dates, raffle links, and drop intel from The Heat Chart newsroom.",
    url: `${siteUrl()}/news`,
    type: "website",
  },
};

export default async function NewsPage() {
  const articles = await getPublishedArticles();
  const [lead, ...rest] = articles;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="tag text-volt">The newsroom</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Drop Report
      </h1>
      <p className="mt-3 max-w-2xl text-smoke">
        Release dates, raffle intel, and the story behind every drop that
        matters — so you cop instead of catching Ls.
      </p>

      <Link
        href="/drops"
        className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-heat/50 bg-surface p-4 transition hover:border-heat"
      >
        <div>
          <p className="tag text-heat">The Drop Calendar</p>
          <p className="text-sm text-smoke">
            Every date + raffle link we track — <span className="text-white">free forever</span>,
            no subscription.
          </p>
        </div>
        <span className="tag rounded-lg bg-heat px-4 py-2 font-bold text-white">Open →</span>
      </Link>

      {articles.length === 0 ? (
        <p className="mt-8 rounded-xl border border-edge bg-surface p-8 text-center text-smoke">
          No stories yet — the first drop reports are on the way.
        </p>
      ) : (
        <>
          <div className="mt-8">
            <ArticleCard article={lead} large />
          </div>
          {rest.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
