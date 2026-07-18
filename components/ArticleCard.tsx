import Link from "next/link";
import { articleTags } from "@/lib/articles";

type Props = {
  article: {
    slug: string;
    title: string;
    excerpt: string;
    coverImage: string | null;
    tags: string | null;
    publishedAt: Date | null;
  };
  large?: boolean;
};

export default function ArticleCard({ article, large = false }: Props) {
  const tags = articleTags(article);
  return (
    <Link
      href={`/news/${article.slug}`}
      className="card-lift group flex flex-col overflow-hidden rounded-xl border border-edge bg-surface"
    >
      <div className={`w-full overflow-hidden bg-panel ${large ? "aspect-[2/1]" : "aspect-[16/9]"}`}>
        {article.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.coverImage}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="display text-2xl text-edge">Drop Report</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          {article.publishedAt && (
            <time dateTime={article.publishedAt.toISOString()} className="tag text-smoke">
              {article.publishedAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          )}
          {tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded bg-panel px-1.5 py-0.5 tag text-volt">
              {t}
            </span>
          ))}
        </div>
        <h3 className={`mt-2 font-bold text-white group-hover:text-volt ${large ? "display text-2xl" : ""}`}>
          {article.title}
        </h3>
        <p className="mt-1 line-clamp-3 text-sm text-smoke">{article.excerpt}</p>
        <span className="tag mt-auto pt-3 text-white group-hover:text-volt">Read →</span>
      </div>
    </Link>
  );
}
