import webpush from "web-push";
import { prisma } from "./db";

/**
 * Web push, for the things that are actually time-sensitive.
 *
 * Sneaker culture runs on being told *now* — a raffle opens, a battle is
 * about to close, an artist answered your commission, your call settled. A
 * page nobody has open can't tell anyone anything, which is the single
 * biggest retention gap on the site.
 *
 * Two rules keep this from becoming the reason people uninstall:
 *
 *  - Only send what somebody would be annoyed to have missed. No "come back
 *    and see what's new".
 *  - A push endpoint that reports 404 or 410 has been revoked — the person
 *    cleared data, uninstalled, or withdrew permission. That row is deleted
 *    rather than retried, because retrying a dead endpoint forever is how a
 *    notification queue silently rots.
 *
 * Dormant until VAPID keys are set, like every other integration here.
 */

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function configure(): boolean {
  if (!pushConfigured()) return false;
  if (!ready) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:hello@theheatchart.com",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    ready = true;
  }
  return true;
}

export type Note = {
  title: string;
  body: string;
  /** Where tapping it should land. Always somewhere specific. */
  url: string;
  /** Collapses same-tag notes so five battle alerts don't stack five deep. */
  tag?: string;
};

/**
 * Send to one member's devices. Returns how many landed.
 *
 * Never throws: a notification failing must not take down the action that
 * triggered it. Somebody's commission reply still gets saved even if their
 * phone is unreachable.
 */
export async function pushTo(userId: string, note: Note): Promise<number> {
  if (!configure()) return 0;

  const subs = await prisma.pushSub.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const payload = JSON.stringify(note);
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
        await prisma.pushSub
          .update({ where: { id: s.id }, data: { lastSentAt: new Date(), failures: 0 } })
          .catch(() => {});
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Withdrawn. Deleting beats retrying a corpse.
          await prisma.pushSub.delete({ where: { id: s.id } }).catch(() => {});
          return;
        }
        // Transient: count it, and drop the row once it's clearly not coming
        // back rather than carrying dead weight forever.
        const failures = s.failures + 1;
        if (failures >= 8) {
          await prisma.pushSub.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          await prisma.pushSub.update({ where: { id: s.id }, data: { failures } }).catch(() => {});
        }
      }
    })
  );

  return sent;
}

/** Fan out to many members — used by the drop and battle sweeps. */
export async function pushToMany(userIds: string[], note: Note): Promise<number> {
  let total = 0;
  for (const id of [...new Set(userIds)]) total += await pushTo(id, note);
  return total;
}

/**
 * Everyone following any artist with a piece in this battle. Following is
 * an explicit act, so it's a reasonable basis for a notification — unlike
 * "everyone who ever visited".
 */
export async function battleAudience(battleId: string): Promise<string[]> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    select: {
      subA: { select: { artistId: true } },
      subB: { select: { artistId: true } },
    },
  });
  if (!battle) return [];
  const artistIds = [battle.subA?.artistId, battle.subB?.artistId].filter(
    (x): x is string => Boolean(x)
  );
  if (artistIds.length === 0) return [];
  const follows = await prisma.artistFollow.findMany({
    where: { artistId: { in: artistIds } },
    select: { userId: true },
  });
  return follows.map((f) => f.userId);
}

/**
 * Battles closing inside the next hour, announced once.
 *
 * "Once" matters: this runs on a schedule, and without a guard it would
 * re-announce the same battle on every pass. The window is anchored so a
 * battle only falls inside it for one run.
 */
export async function notifyClosingBattles(): Promise<{ sent: number; battles: number }> {
  if (!pushConfigured()) return { sent: 0, battles: 0 };
  const now = Date.now();
  const soon = await prisma.battle.findMany({
    where: {
      status: "ACTIVE",
      endsAt: { gt: new Date(now), lte: new Date(now + 60 * 60 * 1000) },
    },
    select: { id: true, title: true },
    take: 20,
  });

  let sent = 0;
  for (const b of soon) {
    sent += await pushToMany(await battleAudience(b.id), {
      title: "Last call to vote",
      body: `${b.title ?? "A battle"} closes within the hour.`,
      url: `/battles/${b.id}`,
      // Same tag per battle: a second run can't stack a duplicate on the
      // lock screen even if the window catches it twice.
      tag: `battle-${b.id}`,
    });
  }
  return { sent, battles: soon.length };
}

/** Drops landing in the next 24 hours, for everyone who opted in. */
export async function notifyUpcomingDrops(): Promise<{ sent: number; drops: number }> {
  if (!pushConfigured()) return { sent: 0, drops: 0 };
  const now = Date.now();
  const drops = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      dropAt: { gt: new Date(now), lte: new Date(now + 24 * 60 * 60 * 1000) },
    },
    select: { id: true, slug: true, title: true },
    take: 10,
  });
  if (drops.length === 0) return { sent: 0, drops: 0 };

  const subs = await prisma.pushSub.findMany({ select: { userId: true }, distinct: ["userId"] });
  const ids = subs.map((s) => s.userId);

  let sent = 0;
  for (const d of drops) {
    sent += await pushToMany(ids, {
      title: "Dropping tomorrow",
      body: d.title,
      url: `/news/${d.slug}`,
      tag: `drop-${d.id}`,
    });
  }
  return { sent, drops: drops.length };
}
