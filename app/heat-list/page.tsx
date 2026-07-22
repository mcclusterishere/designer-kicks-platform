import Link from "next/link";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { categoryLabel } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function HeatListPage() {
  await finalizeExpiredBattles();
  const heat = await getHeatList();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <p className="tag text-volt">Rankings</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        The Heat List
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
        // The standings table — pos · club · P W L · votes, read like a
        // league table because it IS one.
        <div className="mt-8 overflow-hidden rounded-3xl border border-edge bg-surface">
          <div className="grid grid-cols-[2.5rem_1fr_2.2rem_3.6rem] items-center gap-2 border-b border-edge bg-panel/60 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-smoke sm:grid-cols-[3rem_1fr_2.6rem_2.6rem_2.6rem_4.5rem]">
            <span>#</span>
            <span>Piece</span>
            <span className="hidden text-center sm:block">P</span>
            <span className="text-center">W</span>
            <span className="hidden text-center sm:block">L</span>
            <span className="text-right">Votes</span>
          </div>
          <ol className="divide-y divide-edge/60">
            {heat.map((entry, i) => (
              <li
                key={entry.id}
                className={`grid grid-cols-[2.5rem_1fr_2.2rem_3.6rem] items-center gap-2 px-4 py-3 sm:grid-cols-[3rem_1fr_2.6rem_2.6rem_2.6rem_4.5rem] ${
                  i === 0 ? "bg-volt/10" : ""
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-extrabold tabular-nums ${
                    i === 0
                      ? "bg-volt text-white"
                      : i < 3
                        ? "bg-panel text-volt"
                        : "text-smoke"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.imageUrl}
                    alt={entry.title}
                    className="h-11 w-11 shrink-0 rounded-xl border border-edge object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{entry.title}</p>
                    <p className="truncate text-xs text-smoke">
                      {entry.artistSlug ? (
                        <Link href={`/artists/${entry.artistSlug}`} className="hover:text-volt">
                          {entry.artistName}
                        </Link>
                      ) : (
                        entry.artistName
                      )}
                      {" · "}
                      {categoryLabel(entry.category)}
                    </p>
                  </div>
                </div>
                <span className="hidden text-center text-sm tabular-nums text-smoke sm:block">{entry.battles}</span>
                <span className="text-center text-sm font-bold tabular-nums text-white">{entry.wins}</span>
                <span className="hidden text-center text-sm tabular-nums text-smoke sm:block">
                  {entry.battles - entry.wins}
                </span>
                <span className="text-right text-sm font-extrabold tabular-nums text-volt">
                  {entry.totalVotes}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
