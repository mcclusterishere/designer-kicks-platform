import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { finalizeExpiredBattles, getBattleWithVotes } from "@/lib/battles";
import VotePanel from "@/components/VotePanel";
import Countdown from "@/components/Countdown";
import DonorShoe from "@/components/DonorShoe";

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

      {/* The scoreboard — matchday header: crest, live score, crest */}
      <div className="mt-6 rounded-3xl border border-edge bg-surface px-4 py-6">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={battle.subA.imageUrl}
              alt={battle.subA.title}
              className={`h-20 w-20 rounded-2xl border-2 object-cover sm:h-24 sm:w-24 ${
                battle.winnerId === battle.subA.id ? "border-volt" : "border-edge"
              }`}
            />
            <p className="w-full truncate text-center text-xs font-bold text-white">
              {battle.subA.artistName}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center px-2">
            {active ? (
              <span className="mb-2 flex items-center gap-1.5 rounded-full bg-heat/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-heat">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-heat" />
                Live
              </span>
            ) : (
              <span className="mb-2 rounded-full bg-panel px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-smoke">
                FT
              </span>
            )}
            <p className="display text-5xl tabular-nums text-white sm:text-6xl">
              {aVotes}
              <span className="px-2 text-smoke/50">–</span>
              {bVotes}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-smoke/70">votes</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={battle.subB.imageUrl}
              alt={battle.subB.title}
              className={`h-20 w-20 rounded-2xl border-2 object-cover sm:h-24 sm:w-24 ${
                battle.winnerId === battle.subB.id ? "border-volt" : "border-edge"
              }`}
            />
            <p className="w-full truncate text-center text-xs font-bold text-white">
              {battle.subB.artistName}
            </p>
          </div>
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
            videoUrl: battle.subA.videoUrl,
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
            videoUrl: battle.subB.videoUrl,
            extraImages: battle.subB.extraImages,
            votes: bVotes,
          }}
        />
      </div>

      {(battle.subA.category === "sneakers" || battle.subB.category === "sneakers") && (
        <div className="mt-8">
          <div className="rule w-16" />
          <h2 className="display mt-2 text-2xl text-white">Cop The Base Pairs</h2>
          <p className="mt-1 text-sm text-smoke">
            Love the blueprint? Grab the donor shoe these customs were built on.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[battle.subA, battle.subB].map(
              (s) =>
                s.category === "sneakers" && (
                  <div key={s.id} className="rounded-xl border border-edge bg-surface p-4">
                    <p className="tag text-white">{s.title}</p>
                    <DonorShoe
                      brand={s.brand}
                      silhouette={s.silhouette}
                      baseShoe={s.baseShoe}
                      baseColorway={s.baseColorway}
                      refTag={`battle:${battle.id}`}
                    />
                  </div>
                )
            )}
          </div>
        </div>
      )}

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
