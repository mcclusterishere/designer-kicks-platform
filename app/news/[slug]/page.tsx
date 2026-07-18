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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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

      {article.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.coverImage}
          alt={article.title}
          className="mt-6 w-full rounded-xl border border-edge object-cover"
        />
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

      <div className="mt-10 rounded-xl border border-volt/40 bg-surface p-5 text-center">
        <p className="display text-xl text-white">
          Got customs hotter than this drop?
        </p>
        <Link
          href="/submit"
          className="mt-3 inline-block rounded-lg bg-volt px-6 py-2.5 tag font-bold text-ink"
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
