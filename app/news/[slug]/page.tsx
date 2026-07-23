import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getArticleBySlug,
  getPublishedArticles,
  articleTags,
  siteUrl,
} from "@/lib/articles";
import ArticleCard from "@/components/ArticleCard";
import { buyLinks } from "@/lib/affiliates";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/market";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article || article.status !== "PUBLISHED") return { title: "Not found" };

  const url = `${siteUrl()}/news/${article.slug}`;
  const coverAbs = article.coverImage
    ? article.coverImage.startsWith("http")
      ? article.coverImage
      : `${siteUrl()}${article.coverImage}`
    : null;
  return {
    title: `${article.title} — The Heat Chart`,
    description: article.excerpt,
    keywords: articleTags(article),
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      images: coverAbs ? [{ url: coverAbs }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article || article.status !== "PUBLISHED") notFound();

  const tags = articleTags(article);
  const more = (await getPublishedArticles(4)).filter((a) => a.slug !== slug).slice(0, 3);

  // If this story carries a style code, pull the shoe straight from the
  // catalog — its photo (as a cover fallback) and its live prices.
  const shoe = article.sku
    ? await prisma.catalogShoe
        .findUnique({
          where: { sku: article.sku },
          select: {
            sku: true, imageUrl: true, retailPriceCents: true,
            marketPriceCents: true, ebayNewCents: true, ebayUsedCents: true,
          },
        })
        .catch(() => null)
    : null;
  const cover = article.coverImage || shoe?.imageUrl || null;
  const premiumPct =
    shoe?.marketPriceCents && shoe.retailPriceCents
      ? Math.round(((shoe.marketPriceCents - shoe.retailPriceCents) / shoe.retailPriceCents) * 100)
      : null;
  const hasPrices = Boolean(
    shoe && (shoe.retailPriceCents || shoe.marketPriceCents || shoe.ebayNewCents || shoe.ebayUsedCents)
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt,
    image: article.coverImage
      ? [article.coverImage.startsWith("http") ? article.coverImage : `${siteUrl()}${article.coverImage}`]
      : undefined,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: { "@type": "Organization", name: "The Heat Chart", url: siteUrl() },
    publisher: { "@type": "Organization", name: "The Heat Chart", url: siteUrl() },
    mainEntityOfPage: `${siteUrl()}/news/${article.slug}`,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        // Escape < so an article title can never break out of the
        // <script> block (JSON.stringify doesn't escape "</script>").
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <Link href="/news" className="tag text-smoke hover:text-white">
        ← Drop Report
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {article.publishedAt && (
          <time dateTime={article.publishedAt.toISOString()} className="tag text-smoke">
            {article.publishedAt.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        )}
        {tags.map((t) => (
          <span key={t} className="rounded bg-panel px-1.5 py-0.5 tag text-volt">
            {t}
          </span>
        ))}
      </div>

      <h1 className="display mt-3 text-4xl text-white sm:text-5xl">{article.title}</h1>
      <p className="mt-4 text-lg text-smoke">{article.excerpt}</p>

      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt={article.title}
          className="mt-6 w-full rounded-xl border border-edge object-cover"
        />
      )}

      {/* Live prices straight from the catalog — resolved by this story's
          style code. */}
      {hasPrices && shoe && (
        <Link
          href={`/catalog/${encodeURIComponent(shoe.sku)}`}
          className="mt-6 block rounded-xl border border-edge bg-surface p-5 transition hover:border-volt/50"
        >
          <div className="flex items-center justify-between">
            <p className="tag text-volt">Market snapshot</p>
            <p className="tag text-smoke">{shoe.sku}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="tag text-smoke">Retail</p>
              <p className="text-lg font-bold tabular-nums text-white">
                {shoe.retailPriceCents ? formatUsd(shoe.retailPriceCents) : "—"}
              </p>
            </div>
            <div>
              <p className="tag text-smoke">Resale</p>
              <p className="text-lg font-bold tabular-nums text-white">
                {shoe.marketPriceCents ? formatUsd(shoe.marketPriceCents) : "—"}
                {premiumPct !== null && (
                  <span className={`ml-1.5 text-xs font-semibold ${premiumPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {premiumPct >= 0 ? "▲" : "▼"} {Math.abs(premiumPct)}%
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="tag text-smoke">eBay new</p>
              <p className="text-lg font-bold tabular-nums text-white">
                {shoe.ebayNewCents ? formatUsd(shoe.ebayNewCents) : "—"}
              </p>
            </div>
            <div>
              <p className="tag text-smoke">eBay used</p>
              <p className="text-lg font-bold tabular-nums text-white">
                {shoe.ebayUsedCents ? formatUsd(shoe.ebayUsedCents) : "—"}
              </p>
            </div>
          </div>
          <p className="mt-3 tag text-volt">Full market data →</p>
        </Link>
      )}

      <article
        className="prose-invert mt-8 max-w-none space-y-4 leading-relaxed text-neutral-200
          [&_h2]:display [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:text-white
          [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-white
          [&_a]:text-volt [&_a]:underline
          [&_strong]:text-white
          [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6
          [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6
          [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm
          [&_th]:border [&_th]:border-edge [&_th]:bg-panel [&_th]:p-2 [&_th]:text-left
          [&_td]:border [&_td]:border-edge [&_td]:p-2
          [&_blockquote]:border-l-4 [&_blockquote]:border-volt [&_blockquote]:pl-4 [&_blockquote]:text-smoke"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
      </article>

      {(article.dropAt || article.raffleUrl) && (
        <div className="mt-10 rounded-xl border border-edge bg-surface p-5">
          <p className="display text-xl text-white">Where To Buy</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {buyLinks(
              article.title.split(/[—:|(]/)[0].trim(),
              article.raffleUrl,
              article.slug
            ).map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                className="tag rounded-lg border border-volt/40 px-4 py-2.5 text-white transition hover:border-volt hover:bg-volt/10"
              >
                {l.label} ↗
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-smoke">
            Some links are affiliate links — buying through them supports
            the league at no extra cost to you. Launch-day raffles run on
            the retailer&apos;s site.
          </p>
        </div>
      )}

      <div className="mt-10 rounded-xl border border-volt/40 bg-surface p-5 text-center">
        <p className="display text-xl text-white">
          Got customs hotter than this drop?
        </p>
        <Link
          href="/submit"
          className="mt-3 inline-block rounded-lg btn-hard px-6 py-2.5 tag font-bold"
        >
          Enter The Battle Arena
        </Link>
      </div>

      {more.length > 0 && (
        <section className="mt-12">
          <h2 className="display text-2xl text-white">More Drop Intel</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {more.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
