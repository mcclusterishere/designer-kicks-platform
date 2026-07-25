import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

/**
 * The one way credits move.
 *
 * Until now, changing a balance and recording why were two separate writes.
 * Most call sites did both inside a transaction and were fine; the staking
 * code written for the trade panel did not, and logged the entry
 * best-effort — so a failed log left the balance and the ledger permanently
 * and silently disagreeing. That is survivable in a game and disqualifying
 * in anything a regulator looks at, because you can no longer prove what
 * somebody was owed.
 *
 * So atomicity stops being something each call site has to remember. Every
 * movement goes through postCredits, which writes the balance change and the
 * ledger entry in one database transaction, stamps the resulting balance
 * onto the entry, and refuses to go negative.
 *
 * Two properties matter more than the convenience:
 *
 *  BALANCE IS PROVABLE. Each entry carries the balance immediately after it,
 *  written under the same lock as the change. The balance at any past moment
 *  can be read rather than reconstructed, and drift between the stored
 *  balance and the sum of entries becomes detectable instead of theoretical.
 *
 *  PAYING TWICE IS IMPOSSIBLE, NOT UNLIKELY. Any movement that must happen
 *  at most once carries an idempotency key with a unique constraint behind
 *  it. A settlement job that times out and retries loses the race at the
 *  database rather than relying on its own memory of what it already did.
 */

export type PostResult =
  | { ok: true; balance: number; entryId: string; duplicate: false }
  | { ok: true; balance: number; entryId: string; duplicate: true }
  | { ok: false; reason: "insufficient" | "excluded" | "limit" | "error"; detail: string };

/** A Prisma client inside an open transaction. */
export type Tx = Prisma.TransactionClient;

export type PostInput = {
  userId: string;
  /** Positive credits in, negative credits out. */
  delta: number;
  reason: string;
  /** Supply for anything that must happen at most once. */
  idempotencyKey?: string;
  note?: string;
  stripeSessionId?: string;
  /**
   * Skip the play-limit checks. Only for money coming back to someone —
   * a refund or a payout must never be blocked by the limits that govern
   * putting money at risk.
   */
  bypassLimits?: boolean;
};

/** Credits a member has staked today, for the daily limit. */
export async function stakedToday(userId: string, client: Tx | typeof prisma = prisma): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const agg = await client.creditTransaction.aggregate({
    where: { userId, reason: "call-stake", createdAt: { gte: since } },
    _sum: { delta: true },
  });
  return Math.abs(agg._sum.delta ?? 0);
}

export async function isExcluded(
  userId: string,
  client: Tx | typeof prisma = prisma
): Promise<Date | null> {
  const u = await client.user.findUnique({
    where: { id: userId },
    select: { selfExcludedUntil: true },
  });
  const until = u?.selfExcludedUntil ?? null;
  return until && until.getTime() > Date.now() ? until : null;
}

/**
 * The movement itself, run against a caller's open transaction.
 *
 * Most credit spends are one half of something bigger — a strike is spent
 * *and* the run is marked paid; a credit clears a miss *and* the miss flips
 * to cleared. Those have to commit or fail together, so the ledger has to be
 * able to join a transaction rather than insisting on opening its own. A
 * nested $transaction would run on a separate connection and commit
 * independently, which is the exact failure this module exists to prevent.
 *
 * Returns rather than throws for the ordinary refusals (broke, excluded,
 * over the limit) so the caller decides whether that aborts their work. A
 * refusal writes nothing, so a caller that wants to continue safely can.
 */
export async function postCreditsIn(tx: Tx, input: PostInput): Promise<PostResult> {
  const { userId, delta, reason, idempotencyKey, note, stripeSessionId } = input;
  if (!Number.isInteger(delta) || delta === 0) {
    return { ok: false, reason: "error", detail: "delta must be a non-zero integer" };
  }

  // Limits govern putting credits at risk, never getting them back.
  if (delta < 0 && !input.bypassLimits) {
    const excludedUntil = await isExcluded(userId, tx);
    if (excludedUntil) {
      return {
        ok: false,
        reason: "excluded",
        detail: `Self-excluded until ${excludedUntil.toDateString()}.`,
      };
    }
    if (reason === "call-stake") {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { dailyStakeLimit: true },
      });
      const limit = user?.dailyStakeLimit ?? null;
      if (limit !== null) {
        const already = await stakedToday(userId, tx);
        if (already + Math.abs(delta) > limit) {
          return {
            ok: false,
            reason: "limit",
            detail: `That would put you over your ${limit}-credit daily limit (${already} staked today).`,
          };
        }
      }
    }
  }

  // Replay protection first: if this operation already happened, hand back
  // what happened rather than doing it again.
  if (idempotencyKey) {
    const prior = await tx.creditTransaction.findUnique({
      where: { idempotencyKey },
      select: { id: true, balanceAfter: true },
    });
    if (prior) {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });
      return {
        ok: true,
        balance: prior.balanceAfter ?? current?.credits ?? 0,
        entryId: prior.id,
        duplicate: true,
      };
    }
  }

  // Conditional update is the guard against going negative and against two
  // concurrent spends of the same balance: the second one's WHERE no longer
  // matches the row the first one already drained.
  const need = delta < 0 ? Math.abs(delta) : 0;
  const moved = await tx.user.updateMany({
    where: { id: userId, ...(need > 0 ? { credits: { gte: need } } : {}) },
    data: { credits: { increment: delta } },
  });
  if (moved.count === 0) {
    return { ok: false, reason: "insufficient", detail: "Not enough credits." };
  }

  const after = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { credits: true },
  });

  const entry = await tx.creditTransaction.create({
    data: { userId, delta, reason, balanceAfter: after.credits, idempotencyKey, note, stripeSessionId },
    select: { id: true },
  });

  return { ok: true, balance: after.credits, entryId: entry.id, duplicate: false };
}

/**
 * Move credits. Atomic, logged, and idempotent when given a key.
 *
 * Use this when the movement stands alone. When it is part of a larger unit
 * of work, open the transaction yourself and call postCreditsIn.
 */
export async function postCredits(input: PostInput): Promise<PostResult> {
  try {
    return await prisma.$transaction((tx) => postCreditsIn(tx, input));
  } catch (e) {
    // A unique-constraint collision on the idempotency key means a
    // concurrent caller won the race — which is the correct outcome, not a
    // failure. It aborts this transaction, so the recovery reads have to
    // happen out here on a fresh one.
    if ((e as Prisma.PrismaClientKnownRequestError)?.code === "P2002" && input.idempotencyKey) {
      const [u, prior] = await Promise.all([
        prisma.user.findUnique({ where: { id: input.userId }, select: { credits: true } }),
        prisma.creditTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { id: true },
        }),
      ]);
      return { ok: true, balance: u?.credits ?? 0, entryId: prior?.id ?? "", duplicate: true };
    }
    return { ok: false, reason: "error", detail: e instanceof Error ? e.message : "ledger write failed" };
  }
}

export type Drift = {
  userId: string;
  name: string | null;
  stored: number;
  ledger: number;
  diff: number;
};

/**
 * Recompute every balance from the ledger and report disagreement.
 *
 * The point isn't to repair — a silent repair would destroy the evidence of
 * whatever caused the drift. The point is to notice, loudly, while the
 * numbers are small enough to investigate.
 */
export async function reconcile(): Promise<{ checked: number; drifted: Drift[] }> {
  const [users, sums] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, credits: true } }),
    prisma.creditTransaction.groupBy({ by: ["userId"], _sum: { delta: true } }),
  ]);
  const byUser = new Map(sums.map((s) => [s.userId, s._sum.delta ?? 0]));

  const drifted: Drift[] = [];
  for (const u of users) {
    const ledger = byUser.get(u.id) ?? 0;
    if (u.credits !== ledger) {
      drifted.push({ userId: u.id, name: u.name, stored: u.credits, ledger, diff: u.credits - ledger });
    }
  }
  return { checked: users.length, drifted };
}

/** A member's own statement — what moved, when, and the balance after. */
export async function statement(userId: string, take = 100) {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, delta: true, reason: true, balanceAfter: true, note: true, createdAt: true },
  });
}
