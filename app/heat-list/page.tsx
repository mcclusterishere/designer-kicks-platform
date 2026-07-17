import Link from "next/link";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";

export const dynamic = "force-dynamic";

export default async function HeatListPage() {
  await finalizeExpiredBattles();
  const heat = await getHeatList();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <p className="tag text-volt">Rankings</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        The <span className="text-volt">Heat List</span>
      </h1>
      <p className="mt-3 max-w-xl text-smoke">
        Every approved custom, ranked by battle wins first and total votes
        second. Win battles to climb — and check the{" "}
        <Link href="/artists" className="text-volt underline">
          artist league table
        </Link>{" "}
        for career records.
      </p>

      {heat.length === 0 ? (
        <p className="mt-8 rounded-xl border border-edge bg-surface p-8 text-center text-smoke">
          Nothing on the list yet.{" "}
          <Link href="/submit" className="text-volt underline">
            Submit your customs
          </Link>{" "}
          and be first.
        </p>
      ) : (
        <ol className="mt-8 space-y-3">
          {heat.map((entry, i) => (
            <li
              key={entry.id}
              className={`flex items-center gap-4 rounded-xl border bg-surface p-3 ${
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.imageUrl}
                alt={entry.title}
                className="h-20 w-20 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{entry.title}</p>
                <p className="truncate text-sm text-smoke">
                  {entry.baseShoe} · by{" "}
                  {entry.artistSlug ? (
                    <Link
                      href={`/artists/${entry.artistSlug}`}
                      className="text-white underline decoration-volt hover:text-volt"
                    >
                      {entry.artistName}
                    </Link>
                  ) : (
                    entry.artistName
                  )}
                  {entry.socialHandle && (
                    <span className="text-volt"> @{entry.socialHandle}</span>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="display text-xl text-white">
                  {entry.wins}W<span className="text-smoke">–{entry.battles - entry.wins}L</span>
                </p>
                <p className="tag text-smoke">{entry.totalVotes} votes</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
