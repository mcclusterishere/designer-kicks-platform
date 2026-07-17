import type { Metadata } from "next";
import { getPublishedArticles, siteUrl } from "@/lib/articles";
import ArticleCard from "@/components/ArticleCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sneaker Drop News & Release Dates — Designer Kicks",
  description:
    "Upcoming sneaker release dates, raffle links, and drop intel — Jordan retros, Dunks, collabs, and the customs community's take on every major release.",
  alternates: {
    canonical: `${siteUrl()}/news`,
    types: { "application/rss+xml": `${siteUrl()}/news/feed.xml` },
  },
  openGraph: {
    title: "Sneaker Drop News & Release Dates — Designer Kicks",
    description:
      "Upcoming sneaker release dates, raffle links, and drop intel from the Designer Kicks newsroom.",
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
        Drop <span className="text-volt">Report</span>
      </h1>
      <p className="mt-3 max-w-2xl text-smoke">
        Release dates, raffle intel, and the story behind every drop that
        matters — so you cop instead of catching Ls.
      </p>

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
