import { createHmac } from "crypto";
import { prisma } from "./db";
import { sendMail } from "./mailer";

/**
 * Battle alerts: when a battle goes live, every member with battleAlerts
 * on gets an email with the matchup and a one-click, no-login
 * unsubscribe (HMAC-signed link — no tokens stored). Dormant without
 * RESEND_API_KEY like every other send. Push/SMS will ride this same
 * subscription flag when the native app ships.
 */

function secret(): string {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "heatchart-alerts";
}

export function unsubTokenFor(userId: string): string {
  return createHmac("sha256", secret()).update(`unsub|${userId}`).digest("hex").slice(0, 32);
}

export function verifyUnsubToken(userId: string, token: string): boolean {
  return Boolean(userId && token) && unsubTokenFor(userId) === token;
}

const BATCH = 10; // gentle on Resend's rate limits

/**
 * Fire-and-forget from battle creation — never blocks or fails the
 * admin action. At today's member counts a batched loop is plenty; when
 * the list is 10k+ this moves to a queue/broadcast API.
 */
export async function notifyBattleStart(input: {
  battleId: string;
  aTitle: string;
  aArtist: string;
  bTitle: string;
  bArtist: string;
  endsAt: Date;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return; // dormant — nothing to send with
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const battleUrl = `${base}/battles/${input.battleId}`;
  const days = Math.max(1, Math.round((input.endsAt.getTime() - Date.now()) / 86400000));

  const users = await prisma.user.findMany({
    where: { battleAlerts: true },
    select: { id: true, email: true, name: true },
  });

  for (let i = 0; i < users.length; i += BATCH) {
    await Promise.allSettled(
      users.slice(i, i + BATCH).map((u) => {
        const unsub = `${base}/api/unsub?u=${u.id}&t=${unsubTokenFor(u.id)}`;
        return sendMail({
          to: u.email,
          subject: `🔥 New battle live: ${input.aTitle} vs ${input.bTitle}`,
          text:
            `${u.name?.split(" ")[0] ?? "Yo"} — a new battle just went live on The Heat Chart:\n\n` +
            `"${input.aTitle}" by ${input.aArtist}\n   vs\n"${input.bTitle}" by ${input.bArtist}\n\n` +
            `Voting is open for ${days} day${days === 1 ? "" : "s"}. Your vote decides who climbs the chart:\n${battleUrl}\n\n` +
            `—\nThe Heat Chart · custom sneaker culture\n` +
            `Stop battle alerts (one click): ${unsub}`,
        });
      })
    );
  }
}
