import Link from "next/link";
import { notFound } from "next/navigation";
import { finalizeExpiredBattles } from "@/lib/battles";
import { DIVISIONS, getTournamentBySlug, roundName, totalRounds } from "@/lib/tournaments";
import Countdown from "@/components/Countdown";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const t = await getTournamentBySlug(slug);
  if (!t) return { title: "Tournament not found" };
  return {
    title: `${t.name} — Custom Sneaker Tournament Bracket | The Heat Chart`,
    description: `Follow the ${t.name}: ${t.size} custom sneakers, single-elimination vote battles, one champion.`,
  };
}

export default async function TournamentPage({ params }: Props) {
  const { slug } = await params;
  await finalizeExpiredBattles();

  const t = await getTournamentBySlug(slug);
  if (!t) notFound();

  const rounds = totalRounds(t.size);
  const byRound = Array.from({ length: rounds }, (_, i) =>
    t.matches.filter((m) => m.round === i + 1)
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link href="/tournaments" className="tag text-smoke hover:text-white">
        ← All tournaments
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="tag text-heat">
              {t.status === "COMPLETED" ? "Final results" : "Live bracket"}
            </p>
            <span
              className="tag rounded-full border border-volt/50 px-2.5 py-0.5 text-volt"
              title={DIVISIONS[t.division]?.blurb}
            >
              {DIVISIONS[t.division]?.label ?? t.division}
            </span>
          </div>
          <h1 className="display mt-1 text-4xl text-white sm:text-5xl">{t.name}</h1>
          {t.prize && (
            <p className="mt-2 text-sm text-smoke">
              Prize: <span className="text-volt">{t.prize}</span>
            </p>
          )}
        </div>
      </div>

      {t.status === "COMPLETED" && t.champion && (
        <div className="mt-6 flex items-center gap-5 rounded-xl border border-volt bg-surface p-5 glow-volt">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={t.champion.imageUrl}
            alt={t.champion.title}
            className="h-24 w-24 rounded-xl object-cover"
          />
          <div>
            <p className="tag text-volt">Champion</p>
            <p className="display text-3xl text-white">{t.champion.title}</p>
            <p className="text-sm text-smoke">
              by{" "}
              {t.champion.artist?.slug ? (
                <Link href={`/artists/${t.champion.artist.slug}`} className="text-volt underline">
                  {t.champion.artistName}
                </Link>
              ) : (
                t.champion.artistName
              )}
            </p>
          </div>
        </div>
      )}

      {/* Bracket: rounds as columns, horizontal scroll on small screens */}
      <div className="mt-8 overflow-x-auto pb-4">
        <div className="flex min-w-max gap-6">
          {byRound.map((matches, i) => (
            <div key={i} className="flex w-64 flex-col justify-around gap-4">
              <p className="tag text-center text-smoke">{roundName(i + 1, t.size)}</p>
              {matches.map((m) => {
                const aVotes = m.battle
                  ? m.battle.votes.filter((v) => v.submissionId === m.subAId).length
                  : 0;
                const bVotes = m.battle
                  ? m.battle.votes.filter((v) => v.submissionId === m.subBId).length
                  : 0;
                const card = (
                  <div
                    className={`rounded-xl border bg-surface p-3 ${
                      m.battle?.status === "ACTIVE"
                        ? "border-heat/60"
                        : m.winnerId
                          ? "border-edge"
                          : "border-dashed border-edge opacity-70"
                    }`}
                  >
                    {[
                      { sub: m.subA, votes: aVotes, seed: m.seedA },
                      { sub: m.subB, votes: bVotes, seed: m.seedB },
                    ].map(({ sub, votes, seed }, side) => (
                      <div
                        key={side}
                        className={`flex items-center gap-2 py-1.5 ${
                          m.winnerId && sub && m.winnerId !== sub.id ? "opacity-40" : ""
                        }`}
                      >
                        {sub ? (
                          <>
                            {seed && (
                              <span className="tag w-6 shrink-0 text-center text-volt/80">
                                {seed}
                              </span>
                            )}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={sub.imageUrl}
                              alt={sub.title}
                              className="h-10 w-10 shrink-0 rounded object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-white">
                                {sub.title}
                                {m.winnerId === sub.id && " ✓"}
                              </p>
                              <p className="truncate text-xs text-smoke">{sub.artistName}</p>
                            </div>
                            <span className="tag shrink-0 text-smoke">{votes}</span>
                          </>
                        ) : (
                          <div className="flex h-10 w-full items-center justify-center rounded bg-panel">
                            <span className="tag text-smoke">TBD</span>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="mt-1 border-t border-edge pt-2 text-center">
                      {m.battle?.status === "ACTIVE" ? (
                        <span className="tag text-heat">
                          Vote now · <Countdown endsAt={m.battle.endsAt.toISOString()} />
                        </span>
                      ) : m.winnerId ? (
                        <span className="tag text-smoke">Final</span>
                      ) : (
                        <span className="tag text-smoke">Waiting on winners</span>
                      )}
                    </div>
                  </div>
                );
                return m.battle ? (
                  <Link key={m.id} href={`/battles/${m.battle.id}`} className="block transition hover:opacity-90">
                    {card}
                  </Link>
                ) : (
                  <div key={m.id}>{card}</div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-smoke">
        Every matchup is a live vote battle — tap a match to vote. Tied
        rounds advance the higher seed.
      </p>
    </div>
  );
}
