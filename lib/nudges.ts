import { prisma } from "./db";

/**
 * "Pick up where you left off." Cheap per-member open-loop checks that
 * surface at the top of the home page for signed-in members, so the
 * site remembers what they were doing instead of greeting them cold.
 * Everything here is bounded/count-only — safe on every home render.
 */

export type Nudge = { label: string; href: string; emoji: string; hot?: boolean };

export async function getMemberNudges(userId: string): Promise<Nudge[]> {
  const nudges: Nudge[] = [];
  const dayAgo = new Date(Date.now() - 24 * 3_600_000);
  const twoDaysAgo = new Date(Date.now() - 48 * 3_600_000);

  const [liveBattles, myVotes, activeRun, artist, openOffers, recentWins] = await Promise.all([
    prisma.battle.findMany({ where: { status: "ACTIVE" }, select: { id: true } }),
    prisma.vote.findMany({ where: { userId }, select: { battleId: true } }),
    prisma.quizRun.findFirst({
      where: { userId, status: "ACTIVE", currentIndex: { gt: 0 } },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    }),
    prisma.artistProfile.findUnique({
      where: { userId },
      select: { id: true, status: true },
    }),
    // Offers waiting on pieces this member sells (their artist pieces
    // with no owner yet, or pieces they own).
    prisma.offer.count({
      where: {
        status: "OPEN",
        submission: {
          OR: [{ ownerId: userId }, { ownerId: null, artist: { userId } }],
        },
      },
    }),
    // Their pieces that WON a battle in the last 48h — a proud nudge.
    prisma.battle.count({
      where: {
        status: "COMPLETED",
        endsAt: { gte: twoDaysAgo },
        winner: { OR: [{ ownerId: userId }, { artist: { userId } }] },
      },
    }),
  ]);

  // Your piece just won — lead with the win.
  if (recentWins > 0) {
    nudges.push({
      label: recentWins === 1 ? "Your piece won its battle 🏆" : `${recentWins} of your pieces won 🏆`,
      href: "/heat-list",
      emoji: "🏆",
      hot: true,
    });
  }

  // Offers waiting on the seller.
  if (openOffers > 0) {
    nudges.push({
      label: `${openOffers} offer${openOffers === 1 ? "" : "s"} waiting on you`,
      href: "/profile",
      emoji: "💸",
      hot: true,
    });
  }

  // Live battles they haven't judged.
  const voted = new Set(myVotes.map((v) => v.battleId));
  const unjudged = liveBattles.filter((b) => !voted.has(b.id)).length;
  if (unjudged > 0) {
    nudges.push({
      label: `${unjudged} live battle${unjudged === 1 ? "" : "s"} you haven't judged`,
      href: "/battles",
      emoji: "⚔️",
    });
  }

  // A quiz run still in progress.
  if (activeRun) {
    nudges.push({ label: "Your Heat Check run is still live", href: "/quiz", emoji: "🔥" });
  }

  // Artists with a pending application — remind them it's moving.
  if (artist?.status === "PENDING") {
    nudges.push({ label: "Your artist application is under review", href: "/profile", emoji: "🎨" });
  }

  // Cap the strip; hot items already floated to the front.
  void dayAgo;
  return nudges.slice(0, 4);
}
