import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { finalizeExpiredBattles } from "@/lib/battles";
import {
  adminLogout,
  setSubmissionStatus,
  endBattleNow,
  deleteProduct,
} from "@/app/actions";
import LoginForm from "./LoginForm";
import CreateBattleForm from "./CreateBattleForm";
import ProductForm from "./ProductForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
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
  const { edit } = await searchParams;

  const [pending, approved, battles, products, editProduct] = await Promise.all([
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
