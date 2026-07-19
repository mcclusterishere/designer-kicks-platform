import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUserRole } from "@/lib/editor";
import { isAdmin } from "@/lib/admin";
import ArticleForm from "@/app/admin/ArticleForm";
import EditorBroadcastForm from "./EditorBroadcastForm";
import StageProspectForm from "./StageProspectForm";
import MessageOffice from "./MessageOffice";

export const metadata = { title: "Editor Desk — The Heat Chart", robots: { index: false } };
export const dynamic = "force-dynamic";

function ago(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function EditorDesk({
  searchParams,
}: {
  searchParams: Promise<{ editArticle?: string }>;
}) {
  const [me, admin] = await Promise.all([currentUserRole(), isAdmin()]);
  if (!(me?.role === "EDITOR" || admin)) redirect(me ? "/" : "/signin");

  const { editArticle } = await searchParams;
  const [articles, editArticleRow, prospects, thread] = await Promise.all([
    prisma.article.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    editArticle ? prisma.article.findUnique({ where: { id: editArticle } }) : null,
    me
      ? prisma.outreachProspect.findMany({
          where: { stagedById: me.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    me
      ? prisma.editorMessage.findMany({
          where: { editorId: me.id },
          orderBy: { createdAt: "asc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  const threadView = thread.map((m) => ({
    id: m.id,
    body: m.body,
    fromAdmin: m.fromAdmin,
    ago: ago(m.createdAt),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="tag text-volt">Editor Desk</p>
          <h1 className="display mt-1 text-4xl text-white">
            {me?.name || me?.email || "Editor"}
          </h1>
          <p className="mt-1 text-sm text-smoke">
            Content, cross-posting, and outreach — the office reviews what needs
            reviewing. {admin && !me && <span className="text-heat">(viewing as admin)</span>}
          </p>
        </div>
        <span className="tag rounded-full border border-volt/50 px-3 py-1 text-volt">Editor access</span>
      </div>

      {/* 1 · Content */}
      <section className="mt-10">
        <h2 className="display text-2xl text-white">
          {editArticleRow ? "Edit article" : "Write / edit articles"}
        </h2>
        <p className="mt-1 text-sm text-smoke">
          Publish stories, swap cover photos, add new ones. Pick one below to
          edit, or write a fresh one.
        </p>
        {editArticleRow && (
          <p className="mt-2 text-xs text-smoke">
            Editing “{editArticleRow.title}” —{" "}
            <Link href="/editor" className="text-volt underline">start a new one</Link>
          </p>
        )}
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <ArticleForm
            defaults={
              editArticleRow
                ? {
                    id: editArticleRow.id,
                    title: editArticleRow.title,
                    slug: editArticleRow.slug,
                    excerpt: editArticleRow.excerpt,
                    content: editArticleRow.content,
                    coverImage: editArticleRow.coverImage,
                    tags: editArticleRow.tags,
                    status: editArticleRow.status,
                    dropAt: editArticleRow.dropAt,
                    raffleUrl: editArticleRow.raffleUrl,
                    sku: editArticleRow.sku,
                    dropSource: editArticleRow.dropSource,
                    dropCheckedAt: editArticleRow.dropCheckedAt,
                  }
                : undefined
            }
          />
        </div>
        <div className="mt-4 space-y-2">
          {articles.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <Link href={`/news/${a.slug}`} className="font-bold text-white hover:text-volt">{a.title}</Link>{" "}
                <span className={a.status === "PUBLISHED" ? "text-volt" : "text-heat"}>· {a.status.toLowerCase()}</span>
              </div>
              <Link href={`/editor?editArticle=${a.id}`} className="shrink-0 rounded border border-edge px-3 py-1.5 tag text-white hover:border-volt">
                Edit
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 2 · Cross-post */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">Cross-post</h2>
        <p className="mt-1 text-sm text-smoke">
          Posts land on our Feed first (the origin), then fan out to the free
          channels the office has connected. A copy-paste block covers the rest.
        </p>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <EditorBroadcastForm />
        </div>
      </section>

      {/* 3 · Stage outreach */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">Stage outreach</h2>
        <p className="mt-1 text-sm text-smoke">
          Line up prospects for the office — fill in who they are, drop a file,
          add notes. The office reviews and sends.
        </p>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <StageProspectForm />
        </div>
        {prospects.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="tag text-smoke">Your staged prospects</p>
            {prospects.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-bold text-white">{p.name}</span>
                  {p.platform && <span className="text-smoke"> · {p.platform}</span>}
                  {p.handle && <span className="text-smoke"> · {p.handle}</span>}
                </div>
                <span className={`tag shrink-0 ${
                  p.status === "SENT" ? "text-volt" : p.status === "ARCHIVED" ? "text-smoke" : p.status === "APPROVED" ? "text-volt" : "text-heat"
                }`}>
                  {p.status === "STAGED" ? "in review" : p.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4 · Message the office */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">Message the office</h2>
        <p className="mt-1 text-sm text-smoke">
          Your private line to the admin — questions, ideas, anything. This is
          the only inbox you can message.
        </p>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <MessageOffice thread={threadView} />
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-smoke/60">
        The Editor Desk is scoped to content, cross-posting, and outreach — the
        admin panel and everything sensitive stays off-limits.
      </p>
    </div>
  );
}
