import { prisma } from "./db";

/**
 * Direct messages between members.
 *
 * Custom work gets negotiated — size, base pair, reference images, budget,
 * timing — and negotiating that in public comments is how deals die. Without
 * a line here, every one of those conversations moves to Instagram DMs, where
 * nothing is recorded, the platform can't help when it goes wrong, and the
 * artist has no history to point at.
 *
 * Blocks are enforced in both directions. If either party has blocked the
 * other, the thread doesn't open and a send is refused — a block that only
 * worked one way would leave the person who blocked still reachable.
 */

export type ThreadSummary = {
  userId: string;
  name: string;
  artistSlug: string | null;
  lastBody: string;
  lastAt: Date;
  fromMe: boolean;
  unread: number;
};

/** Either direction of a block between two members. */
export async function blockedBetween(a: string, b: string): Promise<boolean> {
  const hit = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(hit);
}

/**
 * Every conversation this member is part of, newest first.
 *
 * Grouped in application code rather than SQL because "the newest message
 * per counterparty, either direction" isn't expressible as one Prisma query,
 * and the volume per member is small enough that fetching their messages and
 * folding them is cheaper than the round trips a per-thread query would cost.
 */
export async function getThreads(userId: string, take = 200): Promise<ThreadSummary[]> {
  const rows = await prisma.directMessage.findMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      fromUser: { select: { id: true, name: true, artistProfile: { select: { slug: true } } } },
      toUser: { select: { id: true, name: true, artistProfile: { select: { slug: true } } } },
    },
  });

  const byOther = new Map<string, ThreadSummary>();
  for (const m of rows) {
    const fromMe = m.fromUserId === userId;
    const other = fromMe ? m.toUser : m.fromUser;
    const existing = byOther.get(other.id);
    if (!existing) {
      byOther.set(other.id, {
        userId: other.id,
        name: other.name || "Member",
        artistSlug: other.artistProfile?.slug ?? null,
        lastBody: m.body,
        lastAt: m.createdAt,
        fromMe,
        // Counted below across the whole window, not just the newest message.
        unread: 0,
      });
    }
    if (!fromMe && !m.readAt) {
      const t = byOther.get(other.id)!;
      t.unread += 1;
    }
  }
  return [...byOther.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}

/** One conversation, oldest first so it reads top to bottom. */
export async function getThread(userId: string, otherId: string, take = 200) {
  if (await blockedBetween(userId, otherId)) return null;
  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [
        { fromUserId: userId, toUserId: otherId },
        { fromUserId: otherId, toUserId: userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take,
    select: { id: true, body: true, createdAt: true, fromUserId: true, readAt: true },
  });
  const other = await prisma.user.findUnique({
    where: { id: otherId },
    select: { id: true, name: true, artistProfile: { select: { slug: true, displayName: true } } },
  });
  if (!other) return null;
  return { other, messages };
}

/** Mark the other side's messages read. Scoped so it can only ever clear your own inbox. */
export async function markRead(userId: string, otherId: string): Promise<void> {
  await prisma.directMessage
    .updateMany({
      where: { toUserId: userId, fromUserId: otherId, readAt: null },
      data: { readAt: new Date() },
    })
    .catch(() => {});
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.directMessage.count({ where: { toUserId: userId, readAt: null } });
}
