import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { finalizeExpiredBattles, getBattleWithVotes } from "@/lib/battles";
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

  const session = await auth();
  const yourVote = session?.user?.id
    ? (
        await prisma.vote.findUnique({
          where: {
            battleId_voterKey: { battleId: battle.id, voterKey: session.user.id },
          },
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
          isAuthed={Boolean(session?.user)}
          yourVote={yourVote}
          winnerId={battle.winnerId}
          a={{
            submissionId: battle.subA.id,
            title: battle.subA.title,
            artistName: battle.subA.artistName,
            artistSlug: battle.subA.artist?.slug ?? null,
            socialHandle: battle.subA.socialHandle,
            baseShoe: battle.subA.baseShoe,
            category: battle.subA.category,
            imageUrl: battle.subA.imageUrl,
            extraImages: battle.subA.extraImages,
            votes: aVotes,
          }}
          b={{
            submissionId: battle.subB.id,
            title: battle.subB.title,
            artistName: battle.subB.artistName,
            artistSlug: battle.subB.artist?.slug ?? null,
            socialHandle: battle.subB.socialHandle,
            baseShoe: battle.subB.baseShoe,
            category: battle.subB.category,
            imageUrl: battle.subB.imageUrl,
            extraImages: battle.subB.extraImages,
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
