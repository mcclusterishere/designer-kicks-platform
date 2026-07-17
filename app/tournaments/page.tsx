import Link from "next/link";
import { finalizeExpiredBattles } from "@/lib/battles";
import { listTournaments, totalRounds } from "@/lib/tournaments";

export const metadata = {
  title: "Tournaments — Custom Sneaker Championships | Designer Kicks",
  description:
    "Bracket championships for custom sneaker artists. Follow live rounds, vote in matchups, and see who takes the crown.",
};
export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  await finalizeExpiredBattles();
  const tournaments = await listTournaments();
  const active = tournaments.filter((t) => t.status === "ACTIVE");
  const completed = tournaments.filter((t) => t.status === "COMPLETED");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <p className="tag text-heat">Championships</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Tournament <span className="text-heat">Brackets</span>
      </h1>
      <p className="mt-3 max-w-xl text-smoke">
        Seeded single-elimination brackets. Every round is a live vote
        battle — winners advance, one custom takes the crown.
      </p>

      <h2 className="display mt-10 text-2xl text-white">Live Brackets</h2>
      {active.length === 0 ? (
        <p className="mt-4 rounded-xl border border-edge bg-surface p-8 text-center text-smoke">
          No tournament running right now — the next bracket is coming.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {active.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.slug}`}
              className="block rounded-xl border border-heat/50 bg-surface p-5 transition hover:border-heat glow-heat"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="display text-2xl text-white">{t.name}</p>
                  <p className="mt-1 text-sm text-smoke">
                    {t.size} customs · {totalRounds(t.size)} rounds
                    {t.prize && (
                      <span className="text-volt"> · Prize: {t.prize}</span>
                    )}
                  </p>
                </div>
                <span className="rounded-lg bg-heat px-5 py-2.5 tag font-bold text-white">
                  View Bracket →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <>
          <h2 className="display mt-12 text-2xl text-smoke">Past Champions</h2>
          <div className="mt-4 space-y-3">
            {completed.map((t) => (
              <Link
                key={t.id}
                href={`/tournaments/${t.slug}`}
                className="flex items-center gap-4 rounded-xl border border-edge bg-surface p-4 transition hover:border-volt/60"
              >
                {t.champion && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.champion.imageUrl}
                    alt={t.champion.title}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white">{t.name}</p>
                  {t.champion && (
                    <p className="text-sm text-smoke">
                      🏆 Champion: <span className="text-volt">{t.champion.title}</span> by{" "}
                      {t.champion.artistName}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
