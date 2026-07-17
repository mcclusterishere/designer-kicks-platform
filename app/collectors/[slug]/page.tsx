import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { computeBadges } from "@/lib/quiz";
import { formatUsd } from "@/lib/market";
import AskForm from "@/components/AskForm";
import RecordSaleForm from "@/components/RecordSaleForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const user = await prisma.user.findUnique({ where: { collectorSlug: slug } });
  if (!user) return { title: "Collector not found" };
  return {
    title: `${user.name ?? "Collector"}'s Closet — Designer Kicks`,
    description: `One-of-one customs owned by ${user.name ?? "a collector"} on Designer Kicks.`,
  };
}

export default async function CollectorPage({ params }: Props) {
  const { slug } = await params;
  await finalizeExpiredBattles();

  const user = await prisma.user.findUnique({
    where: { collectorSlug: slug },
    include: {
      ownedPieces: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { votes: true, battlesWon: true } },
          artist: { select: { slug: true, displayName: true } },
          tournamentsWon: { select: { id: true, name: true } },
          sales: { orderBy: { soldAt: "desc" } },
        },
      },
      _count: { select: { votes: true } },
    },
  });
  if (!user) notFound();

  const session = await auth();
  const isOwnCloset = session?.user?.id === user.id;

  const [heat, quizAgg, wonRuns] = await Promise.all([
    getHeatList(),
    prisma.quizRun.aggregate({
      where: { userId: user.id },
      _sum: { correctCount: true, wrongCount: true },
    }),
    prisma.quizRun.count({ where: { userId: user.id, status: "WON" } }),
  ]);
  const heatRank = new Map(heat.map((h, i) => [h.id, i + 1]));
  const correct = quizAgg._sum.correctCount ?? 0;
  const answered = correct + (quizAgg._sum.wrongCount ?? 0);
  const badges = computeBadges({ wins: wonRuns, answered, correct });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <p className="tag text-volt">Collector</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        {user.name ?? "Collector"}&apos;s <span className="text-gradient-volt">Closet</span>
      </h1>
      <p className="mt-3 max-w-xl text-smoke">
        One-of-one customs in the collection — every piece verified through
        the arena, ranked live on the{" "}
        <Link href="/heat-list" className="text-volt underline">Heat List</Link>.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="tag rounded-full border border-edge px-3 py-1.5 text-smoke">
          {user.ownedPieces.length} piece{user.ownedPieces.length === 1 ? "" : "s"}
        </span>
        <span className="tag rounded-full border border-edge px-3 py-1.5 text-smoke">
          {user._count.votes} votes cast
        </span>
        {badges.map((b) => (
          <span
            key={b.key}
            title={b.description}
            className="rounded-full border border-volt/40 px-3 py-1.5 text-sm text-white"
          >
            {b.emoji} {b.label}
          </span>
        ))}
      </div>

      {user.ownedPieces.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-edge bg-surface p-8 text-center text-smoke">
          The closet is empty — for now.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {user.ownedPieces.map((s) => {
            const rank = heatRank.get(s.id);
            const pendingSale = s.sales.find((sale) => sale.status === "PENDING");
            const lastSale = s.sales.find((sale) => sale.status === "CONFIRMED");
            return (
              <div
                key={s.id}
                className="group overflow-hidden rounded-xl border border-edge bg-surface transition hover:border-volt/50"
              >
                <div className="relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.imageUrl}
                    alt={`${s.title} — custom ${s.baseShoe}`}
                    className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                  {rank && (
                    <span
                      className={`tag absolute left-2 top-2 rounded px-2 py-1 font-bold ${
                        rank <= 3 ? "bg-volt text-ink" : "bg-ink/85 text-volt"
                      }`}
                    >
                      #{rank} Heat
                    </span>
                  )}
                  {s.tournamentsWon.length > 0 && (
                    <span
                      className="absolute right-2 top-2 rounded bg-ink/85 px-2 py-1 text-sm"
                      title={s.tournamentsWon.map((t) => t.name).join(", ")}
                    >
                      {"🏆".repeat(Math.min(s.tournamentsWon.length, 3))}
                    </span>
                  )}
                  {s.askingPriceCents && (
                    <span className="tag absolute bottom-2 left-2 rounded bg-heat px-2 py-1 font-bold text-white">
                      Ask {formatUsd(s.askingPriceCents)}
                    </span>
                  )}
                  {pendingSale && (
                    <span className="tag absolute bottom-2 right-2 rounded bg-ink/85 px-2 py-1 font-bold text-heat">
                      ⏳ Sale Pending
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="tag text-smoke">{s.baseShoe}</p>
                  <p className="mt-1 font-bold text-white">{s.title}</p>
                  <p className="mt-1 text-sm text-smoke">
                    by{" "}
                    {s.artist ? (
                      <Link href={`/artists/${s.artist.slug}`} className="text-volt underline">
                        {s.artist.displayName}
                      </Link>
                    ) : (
                      s.artistName
                    )}{" "}
                    · {s._count.votes} votes
                  </p>
                  {lastSale && (
                    <p className="mt-1 text-sm">
                      <span className="font-bold text-white">{formatUsd(lastSale.priceCents)}</span>{" "}
                      {lastSale.verified ? (
                        <span className="tag text-volt">✓ verified sale</span>
                      ) : (
                        <span className="tag text-smoke">unverified sale</span>
                      )}
                    </p>
                  )}
                  {isOwnCloset && !pendingSale && (
                    <>
                      <AskForm submissionId={s.id} currentAskCents={s.askingPriceCents} />
                      <RecordSaleForm submissionId={s.id} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
