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

function SideThumb({
  sub,
  votes,
  isWinner,
  completed,
}: {
  sub: SubmissionLite;
  votes: number;
  isWinner: boolean;
  completed: boolean;
}) {
  return (
    <div className="relative flex-1 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sub.imageUrl}
        alt={`${sub.title} by ${sub.artistName}`}
        className={`aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.05] ${
          completed && !isWinner ? "opacity-40 grayscale" : ""
        }`}
      />
      {isWinner && (
        <span className="absolute left-2 top-2 rounded bg-volt px-1.5 py-0.5 tag font-bold text-ink">
          W
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8">
        <p className="truncate text-sm font-bold text-white">{sub.title}</p>
        <p className="truncate text-xs text-smoke">
          {sub.artistName} · {votes} votes
        </p>
      </div>
    </div>
  );
}

export default function BattleCard({ battle, aVotes, bVotes }: Props) {
  const completed = battle.status === "COMPLETED";
  return (
    <Link
      href={`/battles/${battle.id}`}
      className="card-lift group block overflow-hidden rounded-xl border border-edge bg-surface"
    >
      <div className="relative flex">
        <SideThumb
          sub={battle.subA}
          votes={aVotes}
          isWinner={battle.winnerId === battle.subA.id}
          completed={completed}
        />
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-heat bg-ink px-3 py-2 display text-sm text-heat glow-heat">
          VS
        </div>
        <SideThumb
          sub={battle.subB}
          votes={bVotes}
          isWinner={battle.winnerId === battle.subB.id}
          completed={completed}
        />
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="truncate text-sm font-semibold text-white">
          {battle.title ?? `${battle.subA.baseShoe} vs ${battle.subB.baseShoe}`}
        </span>
        {completed ? (
          <span className="tag text-smoke">Final</span>
        ) : (
          <Countdown endsAt={battle.endsAt.toISOString()} />
        )}
      </div>
    </Link>
  );
}
