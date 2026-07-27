import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { finalizeExpiredBattles, getBattleWithVotes, sideB } from "@/lib/battles";
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
  const { battle, aVotes, bVotes, aGuest, bGuest } = result;

  const session = await auth();
  // The B corner is a custom or the retail original, depending on format.
  const B = sideB(battle);
  if (!B) notFound();
  const isOG = B.kind === "og";
  // Ballot keys: a custom votes as its submission id, the OG votes as "og".
  const aKey = battle.subA.id;
  const bKey = isOG ? "og" : B.id;

  // Whoever this is — account or a device that already voted — look up their
  // ballot by the same key castVote would have written.
  const { existingGuestKey } = await import("@/lib/guest");
  const voterKey = session?.user?.id ?? (await existingGuestKey());
  const myVote = voterKey
    ? await prisma.vote.findUnique({
        where: { battleId_voterKey: { battleId: battle.id, voterKey } },
      })
    : null;
  // Read the corner, not the submission — an OG vote carries no submission.
  const yourVote = myVote ? (myVote.side === "A" ? aKey : bKey) : null;
  // Winner as a ballot key, so the panel highlights the right corner even
  // when OG culture takes it (winnerId is null in that case by design).
  const winnerKey =
    battle.winnerSide === "A" ? aKey : battle.winnerSide === "B" ? bKey : null;

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
                winnerKey === aKey ? "border-volt" : "border-edge"
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
              src={B.imageUrl ?? "/placeholder.svg"}
              alt={B.title}
              className={`h-20 w-20 rounded-2xl border-2 object-cover sm:h-24 sm:w-24 ${
                winnerKey === bKey ? "border-volt" : "border-edge"
              }`}
            />
            <p className="w-full truncate text-center text-xs font-bold text-white">
              {B.byline}
            </p>
            {isOG && <p className="tag text-heat">OG</p>}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <VotePanel
          battleId={battle.id}
          active={active}
          isAuthed={Boolean(session?.user)}
          yourVote={yourVote}
          winnerId={winnerKey}
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
            submissionId: bKey,
            kind: B.kind,
            title: B.title,
            artistName: B.byline,
            artistSlug: B.artistSlug,
            socialHandle: isOG ? null : battle.subB?.socialHandle ?? null,
            baseShoe: B.shoe ?? "",
            category: isOG ? "sneakers" : battle.subB?.category ?? "sneakers",
            imageUrl: B.imageUrl ?? "/placeholder.svg",
            videoUrl: isOG ? null : battle.subB?.videoUrl ?? null,
            extraImages: isOG ? [] : battle.subB?.extraImages ?? [],
            votes: bVotes,
          }}
        />
      </div>

      {(() => {
        // The customs in this battle — one in a custom-vs-OG matchup, two in
        // a head-to-head. The OG isn't a custom and has no donor shoe: it IS
        // the donor shoe.
        const customs = [battle.subA, ...(isOG ? [] : battle.subB ? [battle.subB] : [])];
        const sneakers = customs.filter((s) => s.category === "sneakers");
        if (!sneakers.length && !isOG) return null;
        return (
          <div className="mt-8">
            <div className="rule w-16" />
            <h2 className="display mt-2 text-2xl text-white">
              {isOG ? "Cop The Original" : "Cop The Base Pairs"}
            </h2>
            <p className="mt-1 text-sm text-smoke">
              {isOG
                ? "Want the untouched pair? This is the silhouette the custom was cut from."
                : "Love the blueprint? Grab the donor shoe these customs were built on."}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {sneakers.map((s) => (
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
              ))}
              {isOG && battle.ogShoe && (
                <div className="rounded-xl border border-heat/40 bg-surface p-4">
                  <p className="tag text-heat">{battle.ogShoe.name} — the OG</p>
                  <DonorShoe
                    brand={battle.ogShoe.brand}
                    silhouette={battle.ogShoe.silhouette}
                    baseShoe={battle.ogShoe.name}
                    baseColorway={battle.ogShoe.colorway}
                    refTag={`battle:${battle.id}`}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {(battle.subA.description || (!isOG && battle.subB?.description)) && (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {[battle.subA, ...(isOG ? [] : battle.subB ? [battle.subB] : [])].map(
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
