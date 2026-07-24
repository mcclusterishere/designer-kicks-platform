import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentSeason, getDraftSlate, getMyEntry, getLeaderboard } from "@/lib/league";
import DraftBoard from "./DraftBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Draft — Weekly Fantasy Sneaker League | The Heat Chart",
  description:
    "Draft a roster of custom 1-of-1s and OG drops. Earn Heat Points as your picks pop — votes, battle wins, sales, resale climb. Free weekly fantasy league.",
  openGraph: {
    title: "The Draft — Weekly Fantasy Sneaker League",
    description:
      "Back the culture. Draft customs + drops, score on real heat and resale movement, climb the weekly leaderboard.",
    type: "website",
  },
};

const DAY = 24 * 60 * 60 * 1000;

export default async function LeaguePage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const season = await getCurrentSeason();
  const daysLeft = Math.max(0, Math.ceil((season.endsAt.getTime() - Date.now()) / DAY));
  const rollLabel = season.endsAt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

  const myEntry = userId ? await getMyEntry(userId, season.id) : null;
  const leaderboard = await getLeaderboard(season.id, userId);
  const slate = userId && !myEntry ? await getDraftSlate() : null;
  const myRow = leaderboard.find((r) => r.you) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      {/* Masthead */}
      <p className="tag text-volt">The Heat Chart · Fantasy League</p>
      <h1 className="display mt-2 text-5xl text-white sm:text-6xl">THE DRAFT</h1>
      <p className="mt-3 max-w-2xl text-lg text-smoke">
        Draft a roster of <span className="text-white">customs</span> and{" "}
        <span className="text-white">OG drops</span>. Rack up Heat Points as your picks pop —
        votes, battle wins, sales, and resale climb. Back the culture, top the board.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full border border-edge bg-panel px-3 py-1 tag text-white">{season.label}</span>
        <span className="text-smoke">
          {daysLeft > 0 ? `Rolls ${rollLabel} · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Rolling to a new week…"}
        </span>
      </div>

      {/* Not signed in */}
      {!userId && (
        <div className="mt-8 rounded-xl border border-edge bg-surface p-6">
          <p className="text-white">
            <Link href="/signin" className="text-volt underline">Sign in</Link> to draft your roster this week.
            It&apos;s free — skill wins, not your wallet.
          </p>
        </div>
      )}

      {/* Signed in, no roster yet → draft */}
      {userId && !myEntry && slate && (
        <div className="mt-8">
          <DraftBoard customs={slate.customs} drops={slate.drops} />
        </div>
      )}

      {/* My roster */}
      {myEntry && (
        <div className="mt-8 rounded-xl border border-edge bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="tag text-volt">Your roster · {season.label}</p>
            <p className="text-right">
              <span className="display text-3xl text-white">{myEntry.total > 0 ? "+" : ""}{myEntry.total}</span>
              <span className="ml-1 tag text-smoke">pts{myRow ? ` · #${myRow.rank}` : ""}</span>
            </p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {myEntry.picks.map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-edge bg-panel p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl || "/seed/news-1.svg"} alt={p.label} className="h-12 w-12 shrink-0 rounded bg-surface object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{p.label}</p>
                  <p className="tag text-smoke">{p.assetType === "CUSTOM" ? "Custom" : "OG Drop"}</p>
                </div>
                <span className={`tabular-nums text-sm font-bold ${p.points >= 0 ? "text-volt" : "text-heat"}`}>
                  {p.points >= 0 ? "+" : ""}{p.points}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-smoke">
            Live points update as your picks move all week. Roster locks until the week rolls.
          </p>
        </div>
      )}

      {/* Leaderboard */}
      <div className="mt-8">
        <h2 className="display text-2xl text-white">This week&apos;s board</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-edge">
          {leaderboard.length === 0 ? (
            <p className="bg-surface p-5 text-sm text-smoke">No rosters yet — be the first to draft.</p>
          ) : (
            leaderboard.map((r) => (
              <div
                key={r.rank}
                className={`flex items-center justify-between gap-3 border-b border-edge/60 px-4 py-2.5 last:border-0 ${r.you ? "bg-volt/10" : "bg-surface"}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-center tag ${r.rank <= 3 ? "text-volt" : "text-smoke"}`}>{r.rank}</span>
                  <span className={`text-sm ${r.you ? "font-bold text-white" : "text-white/90"}`}>{r.name}{r.you ? " (you)" : ""}</span>
                </div>
                <span className={`tabular-nums text-sm font-bold ${r.score >= 0 ? "text-white" : "text-heat"}`}>
                  {r.score >= 0 ? "+" : ""}{r.score}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* How it scores */}
      <div className="mt-8 rounded-xl border border-edge bg-surface p-5 text-sm text-smoke">
        <p className="tag text-volt">How you score</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><span className="text-white">Customs</span> earn on real heat — every vote (+2), battle win (+50), and verified sale (+300) after you draft them.</li>
          <li><span className="text-white">OG drops</span> earn on resale premium — how far the market pushes them over retail. Call the pop before it releases.</li>
          <li>Points are the <span className="text-white">movement since you drafted</span>. Draft early, ride the whole week.</li>
        </ul>
      </div>
    </div>
  );
}
