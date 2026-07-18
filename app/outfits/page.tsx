import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getOutfitBattles } from "@/lib/outfits";
import OutfitVotePanel from "@/components/OutfitVotePanel";

export const metadata = {
  title: "Fit Battles — Outfit vs Outfit | The Heat Chart",
  description:
    "Full looks built from one-of-one customs go head-to-head in one open league — house-curated fits vs fan-built fits, decided by your votes.",
};
export const dynamic = "force-dynamic";

type BattleWithAll = Awaited<ReturnType<typeof getOutfitBattles>>[number];

function toSide(battle: BattleWithAll, which: "A" | "B") {
  const outfit = which === "A" ? battle.outfitA : battle.outfitB;
  const votes = battle.votes.filter((v) => v.outfitId === outfit.id).length;
  return {
    outfitId: outfit.id,
    name: outfit.name,
    byLine:
      outfit.kind === "HOUSE"
        ? "Curated by The House"
        : `Fan fit by ${outfit.owner?.name ?? "a collector"}`,
    items: outfit.items.map((i) => ({
      id: i.submission.id,
      title: i.submission.title,
      imageUrl: i.submission.imageUrl,
      category: i.submission.category,
    })),
    votes,
  };
}

export default async function OutfitsPage() {
  const session = await auth();
  const battles = await getOutfitBattles();
  const myVotes = session?.user?.id
    ? await prisma.outfitVote.findMany({
        where: { userId: session.user.id, battleId: { in: battles.map((b) => b.id) } },
      })
    : [];
  const voteMap = new Map(myVotes.map((v) => [v.battleId, v.outfitId]));

  const active = battles.filter((b) => b.status === "ACTIVE");
  const completed = battles.filter((b) => b.status === "COMPLETED");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="tag text-heat">Outfit vs outfit</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Fit <span className="text-gradient-heat">Battles</span>
      </h1>
      <p className="mt-3 max-w-xl text-smoke">
        Whole looks — sneakers, apparel, accessories — head to head. The
        culture picks the fit. Own pieces?{" "}
        <Link href="/profile" className="text-volt underline">
          Build a fan fit from your closet
        </Link>
        .
      </p>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {[
          { href: "/battles", label: "⚔️ Battles" },
          { href: "/outfits", label: "🧥 Fit Battles", current: true },
          { href: "/rate", label: "🔥 Rate" },
          { href: "/tournaments", label: "🏆 Brackets" },
          { href: "/artists", label: "🥇 League" },
          { href: "/heat-list", label: "🔥 Heat List" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`tag shrink-0 rounded-full border px-4 py-2 transition ${
              l.current
                ? "border-volt bg-volt/10 text-volt"
                : "border-edge text-smoke hover:border-volt hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      {/* One open league: house-curated looks and fan fits share the
          arena — provenance rides on each card, votes settle the rest. */}
      <section className="mt-10">
        <div className="h-1.5 w-16 -skew-x-12 bg-heat" />
        <h2 className="display mt-2 text-2xl text-white sm:text-3xl">Live Fit Battles</h2>
        <p className="mt-1 text-sm text-smoke">
          League-office looks and fan-built fits, one arena. A fan fit
          taking down a house fit is exactly the kind of upset we live for.
        </p>
        {active.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-edge bg-surface p-6 text-center text-smoke">
            No live fit battles right now — new matchups drop as fits come in.
          </p>
        ) : (
          <div className="mt-5 space-y-8">
            {active.map((b) => (
              <div key={b.id}>
                {b.title && <p className="tag mb-2 text-volt">{b.title}</p>}
                <OutfitVotePanel
                  battleId={b.id}
                  a={toSide(b, "A")}
                  b={toSide(b, "B")}
                  active
                  isAuthed={Boolean(session?.user)}
                  yourVote={voteMap.get(b.id) ?? null}
                  winnerId={b.winnerId}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {completed.length > 0 && (
        <section className="mt-12">
          <h2 className="display text-2xl text-smoke">Past Fit Battles</h2>
          <div className="mt-5 space-y-8">
            {completed.slice(0, 4).map((b) => (
              <OutfitVotePanel
                key={b.id}
                battleId={b.id}
                a={toSide(b, "A")}
                b={toSide(b, "B")}
                active={false}
                isAuthed={Boolean(session?.user)}
                yourVote={voteMap.get(b.id) ?? null}
                winnerId={b.winnerId}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
