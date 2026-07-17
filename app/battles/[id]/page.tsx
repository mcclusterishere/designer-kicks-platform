import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { finalizeExpiredBattles, getBattleWithVotes } from "@/lib/battles";
import { getVoterKey } from "@/lib/voter";
import VotePanel from "@/components/VotePanel";
import Countdown from "@/components/Countdown";

export const dynamic = "force-dynamic";

export default async function BattlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await finalizeExpiredBattles();

  const result = await getBattleWithVotes(id);
  if (!result) notFound();
  const { battle, aVotes, bVotes } = result;

  const voterKey = await getVoterKey();
  const yourVote = voterKey
    ? (
        await prisma.vote.findUnique({
          where: { battleId_voterKey: { battleId: battle.id, voterKey } },
        })
      )?.submissionId ?? null
    : null;

  const active = battle.status === "ACTIVE";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link href="/battles" className="tag text-smoke hover:text-white">
        ← All battles
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl text-white sm:text-4xl">
          {battle.title ?? "Head to Head"}
        </h1>
        <div className="rounded-lg border border-edge bg-surface px-4 py-2">
          {active ? (
            <>
              <span className="tag text-smoke">Ends in </span>
              <Countdown endsAt={battle.endsAt.toISOString()} />
            </>
          ) : (
            <span className="tag text-smoke">Battle over</span>
          )}
        </div>
      </div>

      <div className="mt-8">
        <VotePanel
          battleId={battle.id}
          active={active}
          yourVote={yourVote}
          winnerId={battle.winnerId}
          a={{
            submissionId: battle.subA.id,
            title: battle.subA.title,
            artistName: battle.subA.artistName,
            socialHandle: battle.subA.socialHandle,
            baseShoe: battle.subA.baseShoe,
            imageUrl: battle.subA.imageUrl,
            votes: aVotes,
          }}
          b={{
            submissionId: battle.subB.id,
            title: battle.subB.title,
            artistName: battle.subB.artistName,
            socialHandle: battle.subB.socialHandle,
            baseShoe: battle.subB.baseShoe,
            imageUrl: battle.subB.imageUrl,
            votes: bVotes,
          }}
        />
      </div>

      {(battle.subA.description || battle.subB.description) && (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {[battle.subA, battle.subB].map(
            (s) =>
              s.description && (
                <div key={s.id} className="rounded-xl border border-edge bg-surface p-4">
                  <p className="tag text-volt">{s.title} — the story</p>
                  <p className="mt-2 text-sm text-smoke">{s.description}</p>
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
