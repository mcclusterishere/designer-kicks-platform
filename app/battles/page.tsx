import Link from "next/link";
import { prisma } from "@/lib/db";
import { finalizeExpiredBattles } from "@/lib/battles";
import BattleCard from "@/components/BattleCard";

export const metadata = {
  title: "Battle Arena — Vote On Custom Sneaker Matchups | The Heat Chart",
};

export const dynamic = "force-dynamic";

export default async function BattlesPage() {
  await finalizeExpiredBattles();

  const [battles, activeTournaments] = await Promise.all([
    prisma.battle.findMany({
      orderBy: [{ status: "asc" }, { endsAt: "desc" }],
      include: { subA: true, subB: true, votes: { select: { submissionId: true } } },
    }),
    prisma.tournament.findMany({ where: { status: "ACTIVE" } }),
  ]);

  const active = battles.filter((b) => b.status === "ACTIVE");
  const completed = battles.filter((b) => b.status === "COMPLETED");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="tag text-heat">Vote-offs</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Battle <span className="text-gradient-heat">Arena</span>
      </h1>
      <p className="mt-3 max-w-xl text-smoke">
        Two customs enter. The culture votes. Winners take a spot on the{" "}
        <Link href="/heat-list" className="text-volt underline">
          Heat List
        </Link>
        . One vote per battle — make it count.
      </p>

      {/* Arena hub: quick jumps to the competitive surfaces */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {[
          { href: "/battles", label: "⚔️ Battles", current: true },
          { href: "/outfits", label: "🧥 Fit Battles" },
          { href: "/tournaments", label: "🏆 Brackets" },
          { href: "/artists", label: "🥇 League" },
          { href: "/heat-list", label: "🔥 Heat List" },
          { href: "/market", label: "💸 Market" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`tag shrink-0 rounded-full border px-4 py-2 transition ${
              l.current
                ? "border-volt bg-volt/10 text-volt"
                : "border-edge text-smoke hover:border-volt hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      {activeTournaments.length > 0 && (
        <div className="mt-8 space-y-3">
          {activeTournaments.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.slug}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-heat/60 bg-surface p-4 transition hover:border-heat"
            >
              <div>
                <p className="tag text-heat">🏆 Tournament in progress</p>
                <p className="display text-xl text-white">{t.name}</p>
                {t.prize && <p className="text-sm text-smoke">Prize: {t.prize}</p>}
              </div>
              <span className="rounded-lg bg-heat px-5 py-2.5 tag font-bold text-white">
                View Bracket →
              </span>
            </Link>
          ))}
        </div>
      )}

      <h2 className="display mt-10 text-2xl text-white">Live Now</h2>
      {active.length === 0 ? (
        <p className="mt-4 rounded-xl border border-edge bg-surface p-8 text-center text-smoke">
          No live battles at the moment.{" "}
          <Link href="/submit" className="text-volt underline">
            Submit your customs
          </Link>{" "}
          to get in the arena.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          {active.map((b) => (
            <BattleCard
              key={b.id}
              battle={b}
              aVotes={b.votes.filter((v) => v.submissionId === b.subAId).length}
              bVotes={b.votes.filter((v) => v.submissionId === b.subBId).length}
            />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <>
          <h2 className="display mt-12 text-2xl text-smoke">Past Battles</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
            {completed.map((b) => (
              <BattleCard
                key={b.id}
                battle={b}
                aVotes={b.votes.filter((v) => v.submissionId === b.subAId).length}
                bVotes={b.votes.filter((v) => v.submissionId === b.subBId).length}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
