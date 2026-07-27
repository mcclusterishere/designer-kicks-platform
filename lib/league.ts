import { prisma } from "./db";

/**
 * The Draft — weekly fantasy league.
 *
 * Draft a roster of customs (1-of-1 artist pieces) and drops (OG retail
 * releases). Each pick's "metric" is snapshotted at draft time; your live
 * points are how far it has moved since. Customs move on real site signals
 * (votes, battle wins, verified sales); drops move on resale premium. The
 * leaderboard is computed live from current metrics vs. each pick's
 * snapshot, so no cron is required to keep standings honest.
 */

const DAY = 24 * 60 * 60 * 1000;

export const ROSTER_SIZE = 5;

// ---- Metric model (one composite number per pick) ----
// CUSTOM: votes×2 + battleWins×50 + verifiedSales×300 — the site's own heat.
// DROP:   resale premium %  = (market − retail) / retail × 100.
// Live points for a pick = metricNow − metricAtDraft.

async function metricForCustoms(ids: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  ids.forEach((id) => m.set(id, 0));
  if (ids.length === 0) return m;
  const [votes, wins, sales] = await Promise.all([
    // guest: false is load-bearing, not tidiness. The Draft pays real
    // credits and giveaway entries, and this is the number that decides
    // who wins them. The slate below already filtered guest votes and
    // said so in a comment; this scorer did not, so the board showed one
    // number and paid out on another. A guest vote costs a browser and
    // nothing else, which made the prize farmable by anyone patient.
    prisma.vote.groupBy({
      by: ["submissionId"],
      where: { submissionId: { in: ids }, guest: false },
      _count: true,
    }),
    prisma.battle.groupBy({ by: ["winnerId"], where: { winnerId: { in: ids } }, _count: true }),
    prisma.sale.groupBy({ by: ["submissionId"], where: { submissionId: { in: ids }, status: "CONFIRMED" }, _count: true }),
  ]);
  // An OG's votes carry no submissionId — they score no customizer.
  for (const v of votes)
    if (v.submissionId) m.set(v.submissionId, (m.get(v.submissionId) ?? 0) + v._count * 2);
  for (const w of wins) if (w.winnerId) m.set(w.winnerId, (m.get(w.winnerId) ?? 0) + w._count * 50);
  for (const s of sales) m.set(s.submissionId, (m.get(s.submissionId) ?? 0) + s._count * 300);
  return m;
}

function dropPremium(retail: number | null, market: number | null): number {
  if (retail && retail > 0 && market && market > 0) {
    return Math.round(((market - retail) / retail) * 100);
  }
  return 0;
}

async function metricForDrops(ids: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  ids.forEach((id) => m.set(id, 0));
  if (ids.length === 0) return m;
  const shoes = await prisma.catalogShoe.findMany({
    where: { id: { in: ids } },
    select: { id: true, retailPriceCents: true, marketPriceCents: true },
  });
  for (const s of shoes) m.set(s.id, dropPremium(s.retailPriceCents, s.marketPriceCents));
  return m;
}

/** Current metric for a mixed set of picks, keyed by refId. */
async function currentMetrics(picks: { assetType: string; refId: string }[]): Promise<Map<string, number>> {
  const customIds = picks.filter((p) => p.assetType === "CUSTOM").map((p) => p.refId);
  const dropIds = picks.filter((p) => p.assetType === "DROP").map((p) => p.refId);
  const [c, d] = await Promise.all([metricForCustoms(customIds), metricForDrops(dropIds)]);
  const m = new Map<string, number>();
  for (const [k, v] of c) m.set(k, v);
  for (const [k, v] of d) m.set(k, v);
  return m;
}

// ---- Season lifecycle (lazy weekly roll) ----

export async function getCurrentSeason() {
  const now = new Date();
  // Settle any OPEN season that has ended (freezes its scores + ranks).
  const expired = await prisma.leagueSeason.findMany({ where: { status: "OPEN", endsAt: { lt: now } }, select: { id: true } });
  for (const s of expired) await settleSeason(s.id);

  let season = await prisma.leagueSeason.findFirst({
    where: { status: "OPEN", endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
  });
  if (!season) {
    const endsAt = new Date(now.getTime() + 7 * DAY);
    const label = "Week of " + now.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    season = await prisma.leagueSeason.create({ data: { label, startsAt: now, endsAt, status: "OPEN" } });
  }
  return season;
}

/**
 * Weekly payout table. Free-to-play and skill-based: you win by reading the
 * culture right, never by spending. Credits run the Culture IQ game;
 * giveaway entries ride the live giveaway when there is one.
 */
export const PRIZES: { credits: number; entries: number }[] = [
  { credits: 10, entries: 3 }, // 1st
  { credits: 5, entries: 2 }, // 2nd
  { credits: 3, entries: 1 }, // 3rd
];

export async function settleSeason(seasonId: string): Promise<void> {
  // Claim the season atomically. Only the caller that flips OPEN→SETTLED
  // proceeds, so concurrent page loads can never pay a week out twice.
  const claim = await prisma.leagueSeason.updateMany({
    where: { id: seasonId, status: "OPEN" },
    data: { status: "SETTLED" },
  });
  if (claim.count === 0) return;

  const entries = await prisma.leagueEntry.findMany({
    where: { seasonId },
    include: { picks: { select: { assetType: true, refId: true, startMetric: true } } },
  });
  if (entries.length === 0) return;

  const now = await currentMetrics(entries.flatMap((e) => e.picks));
  const scored = entries
    .map((e) => ({
      id: e.id,
      userId: e.userId,
      score: e.picks.reduce((sum, p) => sum + ((now.get(p.refId) ?? 0) - p.startMetric), 0),
    }))
    .sort((a, b) => b.score - a.score);

  await prisma.$transaction(
    scored.map((s, i) =>
      prisma.leagueEntry.update({ where: { id: s.id }, data: { finalScore: s.score, finalRank: i + 1 } })
    )
  );

  // Pay the podium. A roster has to actually move to win — no points, no
  // prize — so an idle week never hands out credits.
  const { grantCredits, getActiveGiveaway } = await import("./quiz");
  const giveaway = await getActiveGiveaway().catch(() => null);

  for (let i = 0; i < Math.min(PRIZES.length, scored.length); i++) {
    const row = scored[i];
    if (row.score <= 0) continue;
    const prize = PRIZES[i];

    await grantCredits(row.userId, prize.credits, "league").catch(() => {});

    let entriesGiven = 0;
    if (giveaway) {
      for (let n = 0; n < prize.entries; n++) {
        const ok = await prisma.giveawayEntry
          .create({ data: { giveawayId: giveaway.id, userId: row.userId, source: "league" } })
          .then(() => true)
          .catch(() => false);
        if (ok) entriesGiven++;
      }
    }

    const label = [
      `${prize.credits} credit${prize.credits === 1 ? "" : "s"}`,
      entriesGiven > 0 ? `${entriesGiven} giveaway entr${entriesGiven === 1 ? "y" : "ies"}` : null,
    ]
      .filter(Boolean)
      .join(" + ");
    await prisma.leagueEntry.update({ where: { id: row.id }, data: { prize: label } }).catch(() => {});
  }
}

// ---- Draft slate ----

export type SlateCustom = { assetType: "CUSTOM"; refId: string; label: string; sub: string; imageUrl: string | null; heat: number };
export type SlateDrop = { assetType: "DROP"; refId: string; label: string; sub: string; imageUrl: string | null; premiumPct: number };

export async function getDraftSlate(): Promise<{ customs: SlateCustom[]; drops: SlateDrop[] }> {
  const [subs, shoes] = await Promise.all([
    prisma.submission.findMany({
      where: { status: "APPROVED" },
      // The Draft pays out credits and giveaway entries, so its heat is
      // account votes only — same rule as the Heat List.
      select: { id: true, title: true, artistName: true, imageUrl: true, _count: { select: { votes: { where: { guest: false } }, battlesWon: true } } },
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.catalogShoe.findMany({
      where: { imageUrl: { not: null }, OR: [{ marketPriceCents: { gt: 0 } }, { retailPriceCents: { gt: 0 } }] },
      select: { id: true, name: true, brand: true, imageUrl: true, retailPriceCents: true, marketPriceCents: true, releaseDate: true },
      orderBy: { releaseDate: { sort: "desc", nulls: "last" } },
      take: 60,
    }),
  ]);

  const customs: SlateCustom[] = subs
    .map((s) => ({
      assetType: "CUSTOM" as const,
      refId: s.id,
      label: s.title,
      sub: s.artistName,
      imageUrl: s.imageUrl,
      heat: s._count.votes * 2 + s._count.battlesWon * 50,
    }))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 24);

  const drops: SlateDrop[] = shoes
    .map((s) => ({
      assetType: "DROP" as const,
      refId: s.id,
      label: s.name,
      sub: s.brand ?? "OG Drop",
      imageUrl: s.imageUrl,
      premiumPct: dropPremium(s.retailPriceCents, s.marketPriceCents),
    }))
    .slice(0, 24);

  return { customs, drops };
}

// ---- My entry + leaderboard ----

export type MyPick = { assetType: string; label: string; imageUrl: string | null; points: number };
export type MyEntry = { picks: MyPick[]; total: number; prize: string | null } | null;

export async function getMyEntry(userId: string, seasonId: string): Promise<MyEntry> {
  const entry = await prisma.leagueEntry.findUnique({
    where: { seasonId_userId: { seasonId, userId } },
    include: { picks: true },
  });
  if (!entry) return null;
  const now = await currentMetrics(entry.picks);
  const picks = entry.picks.map((p) => ({
    assetType: p.assetType,
    label: p.label,
    imageUrl: p.imageUrl,
    points: Math.round((now.get(p.refId) ?? 0) - p.startMetric),
  }));
  return { picks, total: picks.reduce((s, p) => s + p.points, 0), prize: entry.prize };
}

/** Last settled week's podium — proof the prizes are real and already paid. */
export type PastWinner = { name: string; score: number; rank: number; prize: string | null };

export async function getLastWinners(): Promise<{ label: string; winners: PastWinner[] } | null> {
  const season = await prisma.leagueSeason.findFirst({
    where: { status: "SETTLED" },
    orderBy: { endsAt: "desc" },
    select: { label: true },
  });
  if (!season) return null;
  const last = await prisma.leagueSeason.findFirst({
    where: { status: "SETTLED" },
    orderBy: { endsAt: "desc" },
    include: {
      entries: {
        where: { finalRank: { lte: 3 } },
        orderBy: { finalRank: "asc" },
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!last || last.entries.length === 0) return null;
  return {
    label: last.label,
    winners: last.entries.map((e) => ({
      name: e.user.name || "Player",
      score: Math.round(e.finalScore ?? 0),
      rank: e.finalRank ?? 0,
      prize: e.prize,
    })),
  };
}

export type LeaderRow = { name: string; score: number; rank: number; you: boolean };

export async function getLeaderboard(seasonId: string, meId: string | null): Promise<LeaderRow[]> {
  const entries = await prisma.leagueEntry.findMany({
    where: { seasonId },
    include: {
      user: { select: { id: true, name: true } },
      picks: { select: { assetType: true, refId: true, startMetric: true } },
    },
  });
  const settled = entries.some((e) => e.finalRank != null);
  let rows: LeaderRow[];
  if (settled) {
    rows = entries
      .map((e) => ({ name: e.user.name || "Player", score: Math.round(e.finalScore ?? 0), rank: e.finalRank ?? 999, you: e.user.id === meId }))
      .sort((a, b) => a.rank - b.rank);
  } else {
    const now = await currentMetrics(entries.flatMap((e) => e.picks));
    rows = entries
      .map((e) => ({
        name: e.user.name || "Player",
        score: Math.round(e.picks.reduce((sum, p) => sum + ((now.get(p.refId) ?? 0) - p.startMetric), 0)),
        you: e.user.id === meId,
        rank: 0,
      }))
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }
  return rows.slice(0, 50);
}

// ---- Draft action helper (called by the server action) ----

export type DraftInput = { assetType: "CUSTOM" | "DROP"; refId: string }[];

export async function draftRoster(userId: string, picks: DraftInput): Promise<{ ok: boolean; error?: string }> {
  const season = await getCurrentSeason();
  const existing = await prisma.leagueEntry.findUnique({ where: { seasonId_userId: { seasonId: season.id, userId } } });
  if (existing) return { ok: false, error: "You've already drafted this week. Come back next week for a fresh board." };

  // De-dupe + validate size.
  const seen = new Set<string>();
  const clean = picks.filter((p) => (p.assetType === "CUSTOM" || p.assetType === "DROP") && p.refId && !seen.has(p.refId) && seen.add(p.refId));
  if (clean.length !== ROSTER_SIZE) return { ok: false, error: `Pick exactly ${ROSTER_SIZE}.` };

  // Verify the refs are real and snapshot their metrics.
  const customIds = clean.filter((p) => p.assetType === "CUSTOM").map((p) => p.refId);
  const dropIds = clean.filter((p) => p.assetType === "DROP").map((p) => p.refId);
  const [subs, shoes, cMetric, dMetric] = await Promise.all([
    prisma.submission.findMany({ where: { id: { in: customIds }, status: "APPROVED" }, select: { id: true, title: true, imageUrl: true } }),
    prisma.catalogShoe.findMany({ where: { id: { in: dropIds } }, select: { id: true, name: true, imageUrl: true } }),
    metricForCustoms(customIds),
    metricForDrops(dropIds),
  ]);
  const subMap = new Map(subs.map((s) => [s.id, s]));
  const shoeMap = new Map(shoes.map((s) => [s.id, s]));
  if (subMap.size !== customIds.length || shoeMap.size !== dropIds.length) {
    return { ok: false, error: "One of your picks is no longer available — refresh the board." };
  }

  const entry = await prisma.leagueEntry.create({ data: { seasonId: season.id, userId } });
  await prisma.leaguePick.createMany({
    data: clean.map((p) => {
      if (p.assetType === "CUSTOM") {
        const s = subMap.get(p.refId)!;
        return { entryId: entry.id, assetType: "CUSTOM", refId: p.refId, label: s.title, imageUrl: s.imageUrl, startMetric: cMetric.get(p.refId) ?? 0 };
      }
      const s = shoeMap.get(p.refId)!;
      return { entryId: entry.id, assetType: "DROP", refId: p.refId, label: s.name, imageUrl: s.imageUrl, startMetric: dMetric.get(p.refId) ?? 0 };
    }),
  });
  return { ok: true };
}
