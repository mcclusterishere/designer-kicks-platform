import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { finalizeExpiredBattles } from "@/lib/battles";
import BattleCard from "@/components/BattleCard";
import ArenaDeck, { type DeckBattle } from "@/components/ArenaDeck";

export const metadata = {
  title: "Battle Arena — Vote On Custom Sneaker Matchups | The Heat Chart",
};

export const dynamic = "force-dynamic";

function endsLabel(endsAt: Date | null): string {
  if (!endsAt) return "Live";
  const ms = endsAt.getTime() - Date.now();
  if (ms <= 0) return "Closing";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export default async function BattlesPage() {
  await finalizeExpiredBattles();

  const session = await auth();
  const [battles, activeTournaments] = await Promise.all([
    prisma.battle.findMany({
      orderBy: [{ status: "asc" }, { endsAt: "desc" }],
      include: { subA: true, subB: true, votes: { select: { submissionId: true } } },
    }),
    prisma.tournament.findMany({ where: { status: "ACTIVE" } }),
  ]);

  const active = battles.filter((b) => b.status === "ACTIVE");
  const completed = battles.filter((b) => b.status === "COMPLETED");

  // The deck deals only fights this member hasn't judged yet.
  let votedIds = new Set<string>();
  if (session?.user?.id && active.length > 0) {
    const mine = await prisma.vote.findMany({
      where: { userId: session.user.id, battleId: { in: active.map((b) => b.id) } },
      select: { battleId: true },
    });
    votedIds = new Set(mine.map((v) => v.battleId));
  }

  const deck: DeckBattle[] = active
    .filter((b) => !votedIds.has(b.id))
    .map((b) => ({
      id: b.id,
      label: b.title ?? `${b.subA.title} vs ${b.subB.title}`,
      endsLabel: endsLabel(b.endsAt),
      a: {
        submissionId: b.subAId,
        title: b.subA.title,
        artistName: b.subA.artistName,
        imageUrl: b.subA.imageUrl,
        extraImages: b.subA.extraImages,
        votes: b.votes.filter((v) => v.submissionId === b.subAId).length,
      },
      b: {
        submissionId: b.subBId,
        title: b.subB.title,
        artistName: b.subB.artistName,
        imageUrl: b.subB.imageUrl,
        extraImages: b.subB.extraImages,
        votes: b.votes.filter((v) => v.submissionId === b.subBId).length,
      },
    }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      {/* ── Mobile: the voting floor. One fight at a time, nothing else
             competing for the screen. ── */}
      <div className="md:hidden">
        <div className="flex items-baseline justify-between">
          <h1 className="display text-3xl text-white">The Arena</h1>
          <span className="tag text-smoke">{active.length} live</span>
        </div>
        <p className="mt-1.5 text-sm text-smoke">
          Tap a side to vote. Swipe a photo for more angles.
        </p>

        <div className="mt-5">
          <ArenaDeck battles={deck} isAuthed={Boolean(session?.user)} />
        </div>

        {activeTournaments.map((t) => (
          <Link
            key={t.id}
            href={`/tournaments/${t.slug}`}
            className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-heat/60 bg-surface px-4 py-3"
          >
            <div className="min-w-0">
              <p className="tag text-heat">Tournament live</p>
              <p className="display truncate text-lg text-white">{t.name}</p>
            </div>
            <span className="tag shrink-0 text-heat">Bracket →</span>
          </Link>
        ))}

        {/* The rest of the competitive floor — live doors, not labels:
            each chip radiates a staggered heartbeat ring */}
        <p className="tag mt-6 text-heat">More ways to compete</p>
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-2 pt-1">
          {[
            { href: "/rate", label: "🔥 Rate" },
            { href: "/outfits", label: "👟 Fit Battles" },
            { href: "/tournaments", label: "🏆 Brackets" },
            { href: "/heat-list", label: "📈 Heat List" },
            { href: "/artists", label: "🎨 League" },
          ].map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              style={{ animationDelay: `${i * 350}ms` }}
              className="chip-pulse shrink-0 rounded-full border border-volt/50 bg-surface px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {completed.length > 0 && (
          <details className="group mt-6">
            <summary className="tag flex cursor-pointer list-none items-center justify-between rounded-xl border border-edge bg-surface px-4 py-3 text-smoke">
              Past battles ({completed.length})
              <span className="transition group-open:rotate-90">›</span>
            </summary>
            <div className="mt-3 space-y-4">
              {completed.map((b) => (
                <BattleCard
                  key={b.id}
                  battle={b}
                  aVotes={b.votes.filter((v) => v.submissionId === b.subAId).length}
                  bVotes={b.votes.filter((v) => v.submissionId === b.subBId).length}
                />
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ── Desktop: the fixture board ── */}
      <div className="hidden md:block">
        <p className="tag text-heat">Vote-offs</p>
        <h1 className="display mt-2 text-4xl text-white sm:text-5xl">Battle Arena</h1>
        <p className="mt-3 max-w-xl text-smoke">
          Two customs enter. The culture votes. Winners take a spot on the{" "}
          <Link href="/heat-list" className="text-volt underline">
            Heat List
          </Link>
          . One vote per battle — make it count.
        </p>

        <div className="mt-7 flex gap-6 overflow-x-auto border-b border-edge pb-0">
          {[
            { href: "/battles", label: "Battles", current: true },
            { href: "/outfits", label: "Fit Battles" },
            { href: "/rate", label: "Rate" },
            { href: "/quiz", label: "Heat Check" },
            { href: "/tournaments", label: "Brackets" },
            { href: "/artists", label: "League" },
            { href: "/heat-list", label: "Heat List" },
            { href: "/market", label: "Market" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`tag shrink-0 border-b pb-1.5 transition ${
                l.current
                  ? "border-volt text-white"
                  : "border-transparent text-smoke hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {activeTournaments.length > 0 && (
          <div className="mt-8 space-y-3">
            {activeTournaments.map((t) => (
              <Link
                key={t.id}
                href={`/tournaments/${t.slug}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-heat/60 bg-surface p-4 transition hover:border-heat"
              >
                <div>
                  <p className="tag text-heat">Tournament in progress</p>
                  <p className="display text-xl text-white">{t.name}</p>
                  {t.prize && <p className="text-sm text-smoke">Prize: {t.prize}</p>}
                </div>
                <span className="rounded-lg bg-heat px-5 py-2.5 tag font-bold text-white">
                  View Bracket →
                </span>
              </Link>
            ))}
          </div>
        )}

        <h2 className="display mt-10 text-2xl text-white">Live Now</h2>
        {active.length === 0 ? (
          <p className="mt-4 rounded-xl border border-edge bg-surface p-8 text-center text-smoke">
            No live battles at the moment.{" "}
            <Link href="/submit" className="text-volt underline">
              Submit your customs
            </Link>{" "}
            to get in the arena.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
            {active.map((b) => (
              <BattleCard
                key={b.id}
                battle={b}
                aVotes={b.votes.filter((v) => v.submissionId === b.subAId).length}
                bVotes={b.votes.filter((v) => v.submissionId === b.subBId).length}
              />
            ))}
          </div>
        )}

        {completed.length > 0 && (
          <>
            <h2 className="display mt-12 text-2xl text-smoke">Past Battles</h2>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              {completed.map((b) => (
                <BattleCard
                  key={b.id}
                  battle={b}
                  aVotes={b.votes.filter((v) => v.submissionId === b.subAId).length}
                  bVotes={b.votes.filter((v) => v.submissionId === b.subBId).length}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
