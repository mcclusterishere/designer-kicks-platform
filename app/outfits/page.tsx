import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getOutfitBattles } from "@/lib/outfits";
import OutfitVotePanel from "@/components/OutfitVotePanel";

export const metadata = {
  title: "Fit Battles — Outfit vs Outfit | The Heat Chart",
  description:
    "Full looks — kicks, apparel, accessory — go head-to-head. Fans battle fans in the Fan Fit League; the house runs Curator Battles. Your votes decide.",
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
  const fanActive = active.filter((b) => b.league === "FAN");
  const houseActive = active.filter((b) => b.league !== "FAN");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="tag text-heat">Outfit vs outfit</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Fit Battles
      </h1>
      <p className="mt-3 max-w-xl text-smoke">
        Whole looks — sneakers, apparel, accessories — head to head. The
        culture picks the fit. Own pieces?{" "}
        <Link href="/profile" className="text-volt underline">
          Build a fan fit from your closet
        </Link>
        .
      </p>

      <div className="mt-7 flex gap-6 overflow-x-auto border-b border-edge pb-0">
        {[
          { href: "/battles", label: "Battles" },
          { href: "/outfits", label: "Fit Battles", current: true },
          { href: "/rate", label: "Rate" },
          { href: "/quiz", label: "Heat Check" },
          { href: "/tournaments", label: "Brackets" },
          { href: "/artists", label: "League" },
          { href: "/heat-list", label: "Heat List" },
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

      {/* Two leagues: the Fan Fit League (fans' closet looks vs each
          other) and Curator Battles (the house's hand-picked fits). */}
      <section className="mt-10">
        <div className="rule w-16" />
        <h2 className="display mt-2 text-2xl text-white sm:text-3xl">
          <span className="text-volt">Fan Fit League</span>
        </h2>
        <p className="mt-1 text-sm text-smoke">
          Looks built by fans from pieces they actually own, battling other
          fans. Cop a full fit — kicks, apparel, accessory — and enter.
        </p>
        {fanActive.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-edge bg-surface p-6 text-center text-smoke">
            No live fan fit battles yet — build one from your closet to kick it off.
          </p>
        ) : (
          <div className="mt-5 space-y-8">
            {fanActive.map((b) => (
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

      <section className="mt-12">
        <div className="rule w-16" />
        <h2 className="display mt-2 text-2xl text-white sm:text-3xl">Curator Battles</h2>
        <p className="mt-1 text-sm text-smoke">
          The house&apos;s hand-picked looks from across the whole roster,
          head to head.
        </p>
        {houseActive.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-edge bg-surface p-6 text-center text-smoke">
            No live curator battles right now — new matchups drop regularly.
          </p>
        ) : (
          <div className="mt-5 space-y-8">
            {houseActive.map((b) => (
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
