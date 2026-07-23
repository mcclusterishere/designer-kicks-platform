import Link from "next/link";
import Countdown from "./Countdown";

type SubmissionLite = {
  id: string;
  title: string;
  artistName: string;
  baseShoe: string;
  category: string;
  imageUrl: string;
};

type Props = {
  battle: {
    id: string;
    title: string | null;
    status: string;
    endsAt: Date;
    winnerId: string | null;
    subA: SubmissionLite;
    subB: SubmissionLite;
  };
  aVotes: number;
  bVotes: number;
};

/**
 * The match card — a battle presented like a fixture: competition
 * strip up top (LIVE pulse or FT), the two entrants as crests with
 * the live score between them, kickoff-card typography throughout.
 */
function Crest({
  sub,
  isWinner,
  completed,
}: {
  sub: SubmissionLite;
  isWinner: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div
        className={`relative h-24 w-24 overflow-hidden rounded-2xl border-2 transition-transform duration-500 group-hover:scale-[1.04] sm:h-28 sm:w-28 ${
          isWinner ? "border-volt shadow-[0_0_24px_rgba(62,139,255,0.4)]" : "border-edge"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sub.imageUrl}
          alt={`${sub.title} by ${sub.artistName}`}
          className={`h-full w-full object-cover ${completed && !isWinner ? "opacity-40 grayscale" : ""}`}
        />
        {isWinner && (
          <span className="absolute left-1 top-1 rounded-md bg-volt px-1.5 py-0.5 text-[10px] font-extrabold text-white">
            W
          </span>
        )}
      </div>
      {/* w-full is load-bearing: inside items-center the div otherwise
          shrink-wraps its content, truncate never engages, and long
          titles overlap the score. */}
      <div className="w-full min-w-0 text-center">
        <p className="truncate text-sm font-bold text-white">{sub.title}</p>
        <p className="truncate text-xs text-smoke">{sub.artistName}</p>
      </div>
    </div>
  );
}

export default function BattleCard({ battle, aVotes, bVotes }: Props) {
  const completed = battle.status === "COMPLETED";
  return (
    <Link
      href={`/battles/${battle.id}`}
      className="card-lift group block overflow-hidden rounded-3xl border border-edge bg-surface"
    >
      {/* Competition strip */}
      <div className="flex items-center justify-between border-b border-edge/70 px-4 py-2.5">
        <span className="truncate text-xs font-bold uppercase tracking-wide text-smoke">
          {battle.title ?? `${battle.subA.baseShoe} vs ${battle.subB.baseShoe}`}
        </span>
        {completed ? (
          <span className="rounded-full bg-panel px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-smoke">
            FT
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-heat/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-heat">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-heat" />
            Live
          </span>
        )}
      </div>

      {/* The fixture: crest — score — crest */}
      <div className="flex items-center gap-2 px-4 py-5">
        <Crest sub={battle.subA} isWinner={battle.winnerId === battle.subA.id} completed={completed} />
        <div className="flex shrink-0 flex-col items-center px-1">
          <p className="display text-3xl tabular-nums text-white sm:text-4xl">
            {aVotes}
            <span className="px-1.5 text-smoke/60">–</span>
            {bVotes}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-smoke/70">votes</p>
        </div>
        <Crest sub={battle.subB} isWinner={battle.winnerId === battle.subB.id} completed={completed} />
      </div>

      {/* Kickoff line */}
      <div className="flex items-center justify-center gap-2 border-t border-edge/70 px-4 py-2.5 text-xs text-smoke">
        {completed ? (
          <span className="font-bold uppercase tracking-wide">Full time — tap for the recap</span>
        ) : (
          <>
            <span className="font-bold uppercase tracking-wide text-volt">Vote now</span>
            <span aria-hidden>·</span>
            <Countdown endsAt={battle.endsAt.toISOString()} />
          </>
        )}
      </div>
    </Link>
  );
}
