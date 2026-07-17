import Link from "next/link";
import { prisma } from "@/lib/db";
import { finalizeExpiredBattles } from "@/lib/battles";
import BattleCard from "@/components/BattleCard";

export const dynamic = "force-dynamic";

export default async function BattlesPage() {
  await finalizeExpiredBattles();

  const battles = await prisma.battle.findMany({
    orderBy: [{ status: "asc" }, { endsAt: "desc" }],
    include: { subA: true, subB: true, votes: { select: { submissionId: true } } },
  });

  const active = battles.filter((b) => b.status === "ACTIVE");
  const completed = battles.filter((b) => b.status === "COMPLETED");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="tag text-heat">Vote-offs</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Battle <span className="text-heat">Arena</span>
      </h1>
      <p className="mt-3 max-w-xl text-smoke">
        Two customs enter. The culture votes. Winners take a spot on the{" "}
        <Link href="/heat-list" className="text-volt underline">
          Heat List
        </Link>
        . One vote per battle — make it count.
      </p>

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
