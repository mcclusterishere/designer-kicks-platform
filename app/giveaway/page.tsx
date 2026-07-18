import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getActiveGiveaway } from "@/lib/quiz";
import Countdown from "@/components/Countdown";

export const metadata = {
  title: "Rare Shoe Giveaway — The Heat Chart",
  description:
    "Win rare kicks by passing the Jordan trivia Heat Check. No purchase necessary — free entries available daily.",
};
export const dynamic = "force-dynamic";

export default async function GiveawayPage() {
  const session = await auth();
  const giveaway = await getActiveGiveaway();

  const yourEntries =
    session?.user?.id && giveaway
      ? await prisma.giveawayEntry.count({
          where: { giveawayId: giveaway.id, userId: session.user.id },
        })
      : 0;

  const pastWinners = await prisma.giveaway.findMany({
    where: { status: "DRAWN" },
    orderBy: { endsAt: "desc" },
    take: 5,
    include: { winner: { select: { name: true } } },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="tag text-volt">The prize</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Rare Shoe Giveaway
      </h1>

      {giveaway ? (
        <div className="mt-6 rounded-xl border border-volt/60 bg-surface p-6 glow-volt">
          <p className="tag text-smoke">Now running</p>
          <p className="display mt-1 text-3xl text-white">{giveaway.prize}</p>
          {giveaway.description && (
            <p className="mt-2 text-smoke">{giveaway.description}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-smoke">
              Ends in <Countdown endsAt={giveaway.endsAt.toISOString()} />
            </span>
            <span className="text-smoke">
              <span className="text-white">{giveaway._count.entries}</span> total entries
            </span>
            {session?.user && (
              <span className="text-volt">
                You have {yourEntries} {yourEntries === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>
          <Link
            href="/quiz"
            className="mt-5 inline-block rounded-lg bg-heat px-8 py-3.5 tag font-bold text-white glow-heat"
          >
            Earn An Entry — Take The Heat Check
          </Link>
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-edge bg-surface p-8 text-center text-smoke">
          No giveaway running right now — follow the{" "}
          <Link href="/news" className="text-volt underline">Drop Report</Link>{" "}
          for the next announcement.
        </p>
      )}

      {pastWinners.length > 0 && (
        <section className="mt-10">
          <h2 className="display text-2xl text-white">Past Winners</h2>
          <ul className="mt-3 space-y-2">
            {pastWinners.map((g) => (
              <li key={g.id} className="rounded-lg border border-edge bg-surface px-4 py-3 text-sm">
                <span className="text-white">{g.prize}</span>{" "}
                <span className="text-smoke">
                  — won by {g.winner?.name ?? "a lucky sneakerhead"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 rounded-xl border border-edge bg-surface p-5 text-xs text-smoke">
        <p className="tag text-volt">Official rules (summary)</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>No purchase necessary, and purchases never affect your
            odds.</strong> Giveaway entries are earned exclusively by passing
            the Heat Check using free daily strikes. Purchased strike packs
            apply only to leaderboard play and can never produce an entry or
            change your chance of winning.
          </li>
          <li>Open to legal residents 18 years or older. Void where prohibited.</li>
          <li>One winner drawn at random from all entries after the end date.</li>
          <li>Winner is contacted via account email and must respond within 7 days.</li>
          <li>Prize ships free within the continental US.</li>
          <li>Odds depend on the total number of entries received.</li>
        </ul>
        <p className="mt-3 border-t border-edge pt-3">
          Full details:{" "}
          <Link href="/rules" className="text-volt underline">Official Rules</Link>.
          (Drafted for attorney review before the first winner is drawn.)
        </p>
      </section>
    </div>
  );
}
