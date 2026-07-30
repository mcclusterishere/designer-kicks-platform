import { prisma } from "./db";
import { advanceTournaments } from "./tournaments";

// Lazy finalization runs from many public page renders. Under a traffic
// burst, thousands of simultaneous renders would all scan + update the
// same expired battles and race advanceTournaments() into double-created
// rounds. This throttle collapses a burst to one run per interval per
// instance: the first render does the work, the rest no-op. The cron
// endpoint passes force=true so scheduled finalization always runs.
let lastFinalizeAt = 0;
const FINALIZE_INTERVAL_MS = 60 * 1000;

/**
 * Completes any ACTIVE battle whose clock has run out, crowning the
 * submission with more votes. A tie leaves winnerId null (tournament
 * matches resolve ties in favor of the higher seed). Also advances any
 * tournaments whose rounds just completed. Called lazily from pages
 * that show battle state (throttled), plus the cron endpoint (force).
 */
export async function finalizeExpiredBattles(force = false) {
  const now = Date.now();
  if (!force && now - lastFinalizeAt < FINALIZE_INTERVAL_MS) return;
  lastFinalizeAt = now; // claim the slot before awaiting so a burst collapses to one run

  const expired = await prisma.battle.findMany({
    where: { status: "ACTIVE", endsAt: { lt: new Date() } },
    select: { id: true, subAId: true, subBId: true },
  });

  for (const battle of expired) {
    // Account votes only. A win is worth 1000 points of Heat Score, so
    // deciding one on device keys would hand the league to whoever clears
    // cookies fastest. Guest votes still show in the public split.
    // Counted by corner, not by submission: in a custom-vs-OG battle the
    // B corner is a retail shoe with no submission row to tally against.
    const [aVotes, bVotes] = await Promise.all([
      prisma.vote.count({ where: { battleId: battle.id, side: "A", guest: false } }),
      prisma.vote.count({ where: { battleId: battle.id, side: "B", guest: false } }),
    ]);
    const winnerSide = aVotes === bVotes ? null : aVotes > bVotes ? "A" : "B";
    // winnerId stays the submission-level answer so the Heat List and the
    // tournament brackets read it unchanged. Null when the OG takes it —
    // OG culture doesn't collect a customizer's trophy.
    const winnerId =
      winnerSide === "A" ? battle.subAId : winnerSide === "B" ? battle.subBId : null;
    await prisma.battle.update({
      where: { id: battle.id },
      data: { status: "COMPLETED", winnerSide, winnerId },
    });
  }

  await advanceTournaments();
}

export type HeatEntry = {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string | null;
  socialHandle: string | null;
  baseShoe: string;
  category: string;
  imageUrl: string;
  wins: number;
  battles: number;
  totalVotes: number;
  heatScore: number;
};

/**
 * The Heat List: every approved submission ranked by battle wins first,
 * then total votes collected across all battles.
 */
export async function getHeatList(): Promise<HeatEntry[]> {
  const submissions = await prisma.submission.findMany({
    // Attributable artist work only. artistId is SetNull on delete, so a
    // removed artist leaves orphaned pieces behind — those aren't customs
    // anyone can be credited for and don't belong on the league table.
    where: { status: "APPROVED", artistId: { not: null } },
    include: {
      // Ranked on account votes only — see castVote. The `votes` relation
      // filter keeps guests out of the score without a second query.
      _count: { select: { votes: { where: { guest: false } }, battlesWon: true } },
      battlesAsA: { select: { status: true } },
      battlesAsB: { select: { status: true } },
      artist: { select: { slug: true } },
    },
  });

  const entries: HeatEntry[] = submissions.map((s) => {
    const battles =
      s.battlesAsA.filter((b) => b.status === "COMPLETED").length +
      s.battlesAsB.filter((b) => b.status === "COMPLETED").length;
    const wins = s._count.battlesWon;
    const totalVotes = s._count.votes;
    return {
      id: s.id,
      title: s.title,
      artistName: s.artistName,
      artistSlug: s.artist?.slug ?? null,
      socialHandle: s.socialHandle,
      baseShoe: s.baseShoe,
      category: s.category,
      imageUrl: s.imageUrl,
      wins,
      battles,
      totalVotes,
      heatScore: wins * 1000 + totalVotes,
    };
  });

  return entries.sort((a, b) => b.heatScore - a.heatScore);
}

export async function getBattleWithVotes(battleId: string) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      subA: { include: { artist: { select: { slug: true } } } },
      subB: { include: { artist: { select: { slug: true } } } },
      ogShoe: true,
    },
  });
  if (!battle) return null;

  // By corner, so the OG's votes count in a custom-vs-OG battle.
  const [aVotes, bVotes, aGuest, bGuest] = await Promise.all([
    prisma.vote.count({ where: { battleId: battle.id, side: "A", guest: false } }),
    prisma.vote.count({ where: { battleId: battle.id, side: "B", guest: false } }),
    prisma.vote.count({ where: { battleId: battle.id, side: "A", guest: true } }),
    prisma.vote.count({ where: { battleId: battle.id, side: "B", guest: true } }),
  ]);
  return { battle, aVotes, bVotes, aGuest, bGuest };
}

/**
 * The B corner, whichever culture is standing in it — so pages render one
 * shape instead of branching on battle type everywhere. Customs carry an
 * artist; an OG carries the brand that made it.
 */
export type BattleSide = {
  kind: "custom" | "og";
  id: string;
  title: string;
  /** the customizer, or the brand on an OG */
  byline: string;
  artistSlug: string | null;
  imageUrl: string | null;
  /** the donor silhouette on a custom; the silhouette itself on an OG */
  shoe: string | null;
};

export function sideB(battle: {
  type: string;
  subB?: ({ artist?: { slug: string } | null } & {
    id: string; title: string; artistName: string; imageUrl: string; baseShoe: string;
  }) | null;
  ogShoe?: {
    id: string; name: string; brand: string | null;
    silhouette: string | null; colorway: string | null; imageUrl: string | null;
  } | null;
}): BattleSide | null {
  if (battle.type === "CUSTOM_VS_OG" && battle.ogShoe) {
    const og = battle.ogShoe;
    return {
      kind: "og", id: og.id, title: og.name, byline: og.brand ?? "OG",
      artistSlug: null, imageUrl: og.imageUrl,
      shoe: og.silhouette ?? og.colorway ?? null,
    };
  }
  if (battle.subB) {
    const s = battle.subB;
    return {
      kind: "custom", id: s.id, title: s.title, byline: s.artistName,
      artistSlug: s.artist?.slug ?? null, imageUrl: s.imageUrl, shoe: s.baseShoe,
    };
  }
  return null;
}
