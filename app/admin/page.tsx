import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { finalizeExpiredBattles } from "@/lib/battles";
import {
  adminLogout,
  setSubmissionStatus,
  endBattleNow,
  deleteProduct,
  deleteArticle,
  drawGiveawayWinner,
  toggleQuestion,
  deleteQuestion,
  forceAdvanceTournament,
} from "@/app/actions";
import LoginForm from "./LoginForm";
import CreateBattleForm from "./CreateBattleForm";
import ProductForm from "./ProductForm";
import ArticleForm from "./ArticleForm";
import GiveawayForm from "./GiveawayForm";
import QuestionForm from "./QuestionForm";
import TournamentForm from "./TournamentForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; editArticle?: string }>;
}) {
  if (!(await isAdmin())) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="display text-4xl text-white">Admin</h1>
        <LoginForm />
      </div>
    );
  }

  await finalizeExpiredBattles();
  const { edit, editArticle } = await searchParams;

  const [pending, approved, battles, products, editProduct, articles, editArticleRow] = await Promise.all([
    prisma.submission.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.submission.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.battle.findMany({
      orderBy: { createdAt: "desc" },
      include: { subA: true, subB: true, _count: { select: { votes: true } } },
      take: 20,
    }),
    prisma.product.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    edit ? prisma.product.findUnique({ where: { id: edit } }) : null,
    prisma.article.findMany({ orderBy: { createdAt: "desc" } }),
    editArticle ? prisma.article.findUnique({ where: { id: editArticle } }) : null,
  ]);

  const [giveaways, questions, users, tournaments] = await Promise.all([
    prisma.giveaway.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { entries: true } },
        winner: { select: { name: true, email: true } },
      },
    }),
    prisma.quizQuestion.findMany({ orderBy: [{ category: "asc" }, { difficulty: "asc" }] }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { votes: true, giveawayEntries: true } } },
    }),
    prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: { champion: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="display text-4xl text-white">Admin</h1>
        <form action={adminLogout}>
          <button className="tag text-smoke hover:text-white">Log out</button>
        </form>
      </div>

      {/* Pending submissions */}
      <section className="mt-10">
        <h2 className="display text-2xl text-white">
          Review Queue{" "}
          <span className={pending.length ? "text-heat" : "text-smoke"}>
            ({pending.length})
          </span>
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-smoke">Queue is clear.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((s) => (
              <div key={s.id} className="overflow-hidden rounded-xl border border-edge bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.imageUrl} alt={s.title} className="aspect-square w-full object-cover" />
                <div className="p-3">
                  <p className="font-bold text-white">{s.title}</p>
                  <p className="text-sm text-smoke">
                    {s.baseShoe} · {s.artistName}
                    {s.socialHandle && ` · @${s.socialHandle}`}
                  </p>
                  <p className="text-xs text-smoke">{s.email}</p>
                  {s.description && (
                    <p className="mt-1 line-clamp-3 text-xs text-smoke">{s.description}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <form action={setSubmissionStatus.bind(null, s.id, "APPROVED")} className="flex-1">
                      <button className="w-full rounded bg-volt py-2 tag font-bold text-ink">
                        Approve
                      </button>
                    </form>
                    <form action={setSubmissionStatus.bind(null, s.id, "REJECTED")} className="flex-1">
                      <button className="w-full rounded border border-heat py-2 tag text-heat">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create battle */}
      <section className="mt-12 rounded-xl border border-edge bg-surface p-5">
        <h2 className="display text-2xl text-white">Start A Battle</h2>
        <div className="mt-4">
          <CreateBattleForm
            options={approved.map((s) => ({
              id: s.id,
              title: s.title,
              artistName: s.artistName,
            }))}
          />
        </div>
      </section>

      {/* Battles */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">Battles</h2>
        <div className="mt-4 space-y-2">
          {battles.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
            >
              <div>
                <Link href={`/battles/${b.id}`} className="font-bold text-white hover:text-volt">
                  {b.subA.title} vs {b.subB.title}
                </Link>
                <p className="text-xs text-smoke">
                  {b.status} · {b._count.votes} votes · ends{" "}
                  {b.endsAt.toISOString().slice(0, 10)}
                  {b.winnerId && ` · winner: ${b.winnerId === b.subAId ? b.subA.title : b.subB.title}`}
                </p>
              </div>
              {b.status === "ACTIVE" && (
                <form action={endBattleNow.bind(null, b.id)}>
                  <button className="rounded border border-heat px-3 py-1.5 tag text-heat">
                    End now
                  </button>
                </form>
              )}
            </div>
          ))}
          {battles.length === 0 && <p className="text-sm text-smoke">No battles yet.</p>}
        </div>
      </section>

      {/* Tournaments */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">Tournaments</h2>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <p className="tag text-heat">Launch a bracket</p>
          <div className="mt-3">
            <TournamentForm
              options={approved.map((s) => ({
                id: s.id,
                title: s.title,
                artistName: s.artistName,
              }))}
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {tournaments.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
            >
              <div>
                <Link href={`/tournaments/${t.slug}`} className="font-bold text-white hover:text-volt">
                  {t.name}
                </Link>{" "}
                <span className={t.status === "ACTIVE" ? "text-heat" : "text-smoke"}>
                  · {t.status.toLowerCase()} · {t.size} customs
                </span>
                {t.champion && (
                  <p className="text-xs text-smoke">🏆 {t.champion.title} by {t.champion.artistName}</p>
                )}
              </div>
              {t.status === "ACTIVE" && (
                <form action={forceAdvanceTournament.bind(null, t.id)}>
                  <button className="rounded border border-heat px-3 py-1.5 tag text-heat">
                    End round now
                  </button>
                </form>
              )}
            </div>
          ))}
          {tournaments.length === 0 && <p className="text-sm text-smoke">No tournaments yet.</p>}
        </div>
      </section>

      {/* Giveaways */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">Giveaways</h2>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <p className="tag text-heat">Launch a giveaway</p>
          <div className="mt-3">
            <GiveawayForm />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {giveaways.map((g) => (
            <div
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
            >
              <div>
                <span className="font-bold text-white">{g.prize}</span>{" "}
                <span className={g.status === "ACTIVE" ? "text-volt" : "text-smoke"}>
                  · {g.status.toLowerCase()}
                </span>
                <p className="text-xs text-smoke">
                  {g._count.entries} entries · ends {g.endsAt.toISOString().slice(0, 10)}
                  {g.winner && ` · winner: ${g.winner.name} (${g.winner.email})`}
                </p>
              </div>
              {g.status === "ACTIVE" && (
                <form action={drawGiveawayWinner.bind(null, g.id)}>
                  <button className="rounded border border-heat px-3 py-1.5 tag text-heat">
                    Draw winner now
                  </button>
                </form>
              )}
            </div>
          ))}
          {giveaways.length === 0 && <p className="text-sm text-smoke">No giveaways yet.</p>}
        </div>
      </section>

      {/* Quiz questions */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">
          Quiz Questions{" "}
          <span className="text-smoke">
            ({questions.filter((q) => q.active).length} active / {questions.length})
          </span>
        </h2>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <p className="tag text-volt">Add a question</p>
          <div className="mt-3">
            <QuestionForm />
          </div>
        </div>
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
          {questions.map((q) => (
            <div
              key={q.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm ${
                q.active ? "" : "opacity-50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-white">{q.question}</p>
                <p className="text-xs text-smoke">
                  {q.category} · difficulty {q.difficulty} ·{" "}
                  answer: {(JSON.parse(q.options) as string[])[q.answerIndex]}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={toggleQuestion.bind(null, q.id)}>
                  <button className="rounded border border-edge px-3 py-1.5 tag text-white hover:border-volt">
                    {q.active ? "Disable" : "Enable"}
                  </button>
                </form>
                <form action={deleteQuestion.bind(null, q.id)}>
                  <button className="rounded border border-heat px-3 py-1.5 tag text-heat">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
          {questions.length === 0 && (
            <p className="text-sm text-smoke">No questions yet — run the seed or add some above.</p>
          )}
        </div>
      </section>

      {/* Users */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl text-white">
            Members <span className="text-smoke">({users.length}{users.length === 50 ? "+" : ""})</span>
          </h2>
          <a
            href="/api/admin/users.csv"
            className="rounded-lg border border-volt px-4 py-2 tag text-volt hover:bg-volt hover:text-ink"
          >
            Export CSV
          </a>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel">
              <tr>
                {["Name", "Email", "Phone", "City", "Size", "IG", "Opt-in", "Votes", "Entries"].map((h) => (
                  <th key={h} className="px-3 py-2 tag text-smoke">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-edge">
                  <td className="px-3 py-2 text-white">{u.name}</td>
                  <td className="px-3 py-2 text-smoke">{u.email}</td>
                  <td className="px-3 py-2 text-smoke">{u.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-smoke">{u.city ?? "—"}</td>
                  <td className="px-3 py-2 text-smoke">{u.shoeSize ?? "—"}</td>
                  <td className="px-3 py-2 text-smoke">{u.instagram ? `@${u.instagram}` : "—"}</td>
                  <td className="px-3 py-2">{u.marketingOptIn ? "✅" : "—"}</td>
                  <td className="px-3 py-2 text-smoke">{u._count.votes}</td>
                  <td className="px-3 py-2 text-smoke">{u._count.giveawayEntries}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-smoke">
                    No members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Newsroom */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">
          Newsroom <span className="text-smoke">({articles.length})</span>
        </h2>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <p className="tag text-volt">{editArticleRow ? "Edit article" : "Write article"}</p>
          {editArticleRow && (
            <p className="mt-1 text-xs text-smoke">
              Editing “{editArticleRow.title}” —{" "}
              <Link href="/admin" className="text-volt underline">cancel</Link>
            </p>
          )}
          <div className="mt-3">
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
                    }
                  : undefined
              }
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {articles.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/news/${a.slug}`}
                  className="font-bold text-white hover:text-volt"
                >
                  {a.title}
                </Link>{" "}
                <span className={a.status === "PUBLISHED" ? "text-volt" : "text-heat"}>
                  · {a.status.toLowerCase()}
                </span>
                <p className="truncate text-xs text-smoke">/news/{a.slug}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/admin?editArticle=${a.id}`}
                  className="rounded border border-edge px-3 py-1.5 tag text-white hover:border-volt"
                >
                  Edit
                </Link>
                <form action={deleteArticle.bind(null, a.id)}>
                  <button className="rounded border border-heat px-3 py-1.5 tag text-heat">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
          {articles.length === 0 && <p className="text-sm text-smoke">No articles yet.</p>}
        </div>
      </section>

      {/* Products */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">
          Shop Products <span className="text-smoke">({products.length})</span>
        </h2>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <p className="tag text-volt">{editProduct ? "Edit product" : "Add product"}</p>
          {editProduct && (
            <p className="mt-1 text-xs text-smoke">
              Editing “{editProduct.name}” —{" "}
              <Link href="/admin" className="text-volt underline">cancel</Link>
            </p>
          )}
          <div className="mt-3">
            <ProductForm
              defaults={
                editProduct
                  ? {
                      id: editProduct.id,
                      name: editProduct.name,
                      merchant: editProduct.merchant,
                      category: editProduct.category,
                      blurb: editProduct.blurb,
                      price: editProduct.price,
                      imageUrl: editProduct.imageUrl,
                      affiliateUrl: editProduct.affiliateUrl,
                      featured: editProduct.featured,
                    }
                  : undefined
              }
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <span className="font-bold text-white">{p.name}</span>{" "}
                <span className="text-smoke">
                  · {p.merchant} · {p.category}
                  {p.featured && " · ⭐ featured"}
                </span>
                <p className="truncate text-xs text-smoke">{p.affiliateUrl}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/admin?edit=${p.id}`}
                  className="rounded border border-edge px-3 py-1.5 tag text-white hover:border-volt"
                >
                  Edit
                </Link>
                <form action={deleteProduct.bind(null, p.id)}>
                  <button className="rounded border border-heat px-3 py-1.5 tag text-heat">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
