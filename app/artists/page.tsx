import Link from "next/link";
import { finalizeExpiredBattles } from "@/lib/battles";
import { getArtistRankings } from "@/lib/artists";

export const metadata = {
  title: "The League — Custom Sneaker Artist Rankings | Designer Kicks",
  description:
    "Every custom sneaker artist in the arena, ranked by battle wins and votes. Follow your favorites and watch the league table move.",
};
export const dynamic = "force-dynamic";

export default async function ArtistsPage() {
  await finalizeExpiredBattles();
  const rankings = await getArtistRankings();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <p className="tag text-volt">The league</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Artist <span className="text-gradient-volt">Rankings</span>
      </h1>
      <p className="mt-3 max-w-xl text-smoke">
        Career records across every battle. Wins move you up, votes break
        ties — one artist, one record, no matter how many shoes they run.
      </p>

      {rankings.length === 0 ? (
        <p className="mt-8 rounded-xl border border-edge bg-surface p-8 text-center text-smoke">
          No ranked artists yet —{" "}
          <Link href="/submit" className="text-volt underline">
            submit your customs
          </Link>{" "}
          to claim the first spot.
        </p>
      ) : (
        <ol className="mt-8 space-y-3">
          {rankings.map((a, i) => (
            <li key={a.id}>
              <Link
                href={`/artists/${a.slug}`}
                className={`flex items-center gap-4 rounded-xl border bg-surface p-3 transition hover:border-volt/60 ${
                  i === 0 ? "border-volt glow-volt" : "border-edge"
                }`}
              >
                <span
                  className={`display w-14 shrink-0 text-center text-3xl ${
                    i === 0 ? "text-volt" : i < 3 ? "text-heat" : "text-smoke"
                  }`}
                >
                  {i + 1}
                </span>
                {a.topImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.topImageUrl}
                    alt={`${a.displayName}'s top custom`}
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-lg bg-panel" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-white">{a.displayName}</p>
                  <p className="truncate text-sm text-smoke">
                    {a.shoeCount} shoe{a.shoeCount === 1 ? "" : "s"}
                    {a.instagram && <span className="text-volt"> · @{a.instagram}</span>}
                    {a.city && ` · ${a.city}`}
                  </p>
                  <p className="tag mt-0.5 text-smoke">{a.followers} followers</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="display text-xl text-white">
                    {a.wins}W<span className="text-smoke">–{a.losses}L</span>
                  </p>
                  <p className="tag text-smoke">{a.totalVotes} votes</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-8 rounded-xl border border-edge bg-surface p-4 text-sm text-smoke">
        Looking for individual shoes? The{" "}
        <Link href="/heat-list" className="text-volt underline">Heat List</Link>{" "}
        ranks every custom in the arena.
      </p>
    </div>
  );
}
