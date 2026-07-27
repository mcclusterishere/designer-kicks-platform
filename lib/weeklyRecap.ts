import { prisma } from "./db";
import { getTasteProfile } from "./taste";
import { sendMail } from "./mailer";
import { unsubTokenFor } from "./battleAlerts";

/**
 * The weekly personal recap — a member's own week in the league,
 * emailed once a week. Built to feel like the site was watching FOR
 * them: votes cast, quiz answered, their top brand, and (for artists)
 * their record and new followers. Skips anyone who did nothing this
 * week so we never send an empty "you did 0 things" note.
 */

function base(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function buildWeeklyRecap(
  userId: string
): Promise<{ subject: string; text: string } | null> {
  const since = new Date(Date.now() - 7 * 24 * 3_600_000);

  const [user, votes, quizRuns, artist, taste] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.vote.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.quizRun.findMany({
      where: { userId, startedAt: { gte: since } },
      select: { correctCount: true },
    }),
    prisma.artistProfile.findUnique({
      where: { userId },
      select: { id: true, displayName: true, submissions: { select: { id: true } } },
    }),
    getTasteProfile(userId).catch(() => null),
  ]);
  if (!user) return null;

  const quizCorrect = quizRuns.reduce((s, r) => s + r.correctCount, 0);
  const lines: string[] = [];

  if (votes > 0) lines.push(`• You judged ${votes} battle${votes === 1 ? "" : "s"} — every vote moved the chart.`);
  if (quizCorrect > 0) lines.push(`• You banked ${quizCorrect} correct on the Heat Check.`);

  const topBrand = taste?.brands?.[0]?.name;
  if (topBrand) lines.push(`• Your taste leaned hardest toward ${topBrand} this week.`);

  // Artist-only: record + new followers over the week.
  if (artist && artist.submissions.length > 0) {
    const pieceIds = artist.submissions.map((s) => s.id);
    const [wins, losses, newFollows] = await Promise.all([
      prisma.battle.count({
        where: { status: "COMPLETED", endsAt: { gte: since }, winnerId: { in: pieceIds } },
      }),
      prisma.battle.count({
        where: {
          status: "COMPLETED",
          endsAt: { gte: since },
          winnerId: { notIn: pieceIds },
          OR: [{ subAId: { in: pieceIds } }, { subBId: { in: pieceIds } }],
        },
      }),
      prisma.artistFollow.count({ where: { artistId: artist.id, createdAt: { gte: since } } }),
    ]);
    if (wins || losses) lines.push(`• Your pieces went ${wins}-${losses} in the arena this week.`);
    if (newFollows > 0) lines.push(`• ${newFollows} new follower${newFollows === 1 ? "" : "s"} backed your work.`);
  }

  // Nothing happened — don't send.
  if (lines.length === 0) return null;

  const first = user.name?.split(" ")[0] ?? "Yo";
  const b = base();
  const unsub = `${b}/api/unsub?u=${userId}&t=${unsubTokenFor(userId)}`;
  const text =
    `${first} — here's your week on The Heat Chart:\n\n` +
    lines.join("\n") +
    `\n\nThe floor's already loading next week's battles. Come run it back:\n${b}/battles\n\n` +
    `—\nThe Heat Chart · custom sneaker culture\n` +
    `Turn off weekly recaps (one click): ${unsub}`;

  return { subject: `Your week in the league, ${first} 🔥`, text };
}

/**
 * Sends the recap to every opted-in member active in the last ~2
 * weeks, in gentle batches. Returns counts for the cron response.
 */
export async function sendWeeklyRecaps(): Promise<{ considered: number; sent: number }> {
  if (!process.env.RESEND_API_KEY) return { considered: 0, sent: 0 };
  const active = new Date(Date.now() - 14 * 24 * 3_600_000);

  // Opted-in members who did SOMETHING recently — never email dormant
  // accounts. "battleAlerts" is the standing email-consent flag.
  const users = await prisma.user.findMany({
    where: {
      battleAlerts: true,
      OR: [
        { votes: { some: { createdAt: { gte: active } } } },
        { quizRuns: { some: { startedAt: { gte: active } } } },
      ],
    },
    select: { id: true, email: true },
    take: 5000,
  });

  const BATCH = 10;
  let sent = 0;
  for (let i = 0; i < users.length; i += BATCH) {
    await Promise.allSettled(
      users.slice(i, i + BATCH).map(async (u) => {
        const recap = await buildWeeklyRecap(u.id);
        if (!recap) return;
        const res = await sendMail({ to: u.email, subject: recap.subject, text: recap.text });
        if (res.delivered) sent++;
      })
    );
  }
  return { considered: users.length, sent };
}
