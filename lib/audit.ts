import { prisma } from "./db";

/**
 * The record of staff touching somebody else's work.
 *
 * Admin power over user content is intended and necessary — someone has
 * to be able to fix a broken photo, pull abuse, or correct a mis-recorded
 * sale. The problem was never that the power existed. It was that it was
 * invisible: an admin could add photos to an artist's piece, accept an
 * offer on their behalf or delete their post, and nothing anywhere
 * recorded it and the artist was never told.
 *
 * That is the line between administration and interference, and the only
 * things separating them are a log and a notification. Both live here.
 *
 * Two rules:
 *
 *   1. Log AFTER the write succeeds, never before. A log entry for
 *      something that then failed is worse than no entry — it makes the
 *      record lie in the direction of "we did something we didn't".
 *   2. Never let logging break the operation. A failed insert here must
 *      not roll back a legitimate moderation action, so every call is
 *      fire-and-forget.
 */

export type AuditActor = {
  id: string | null;
  email: string | null;
  /** admin | editor | system */
  role: string;
};

export type AuditInput = {
  actor: AuditActor;
  action: string;
  targetType: "submission" | "offer" | "feedPost" | "sale" | "artistProfile" | "user";
  targetId: string;
  /** The user whose content this is — what lets them see their own entries. */
  targetOwnerId?: string | null;
  summary: string;
};

/**
 * Write one entry. Only call this when the actor is NOT the owner —
 * logging people editing their own work would bury the entries that
 * matter under thousands that don't.
 */
export async function recordStaffAction(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        actorRole: input.actor.role,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        targetOwnerId: input.targetOwnerId ?? null,
        summary: input.summary.slice(0, 500),
      },
    });
  } catch {
    // Deliberately swallowed — see rule 2 above.
  }
}

/**
 * Build an actor from a session, without importing one.
 *
 * This module stays dependency-free apart from prisma — it is compiled
 * standalone by the verify script, and reaching for the auth module here
 * drags the entire framework in behind it. The caller already has the
 * session; it just passes the two fields.
 *
 * The admin console authenticates with its own password rather than a
 * member session, so there may be no user id at all. That is recorded
 * honestly as a console action rather than attributed to whoever happens
 * to be signed in as a member in the same browser.
 */
export function actorFrom(
  session: { user?: { id?: string | null; email?: string | null } } | null,
  role: "admin" | "editor"
): AuditActor {
  const id = session?.user?.id ?? null;
  return {
    id,
    email: session?.user?.email ?? null,
    role: id ? role : `${role}-console`,
  };
}

/** Everything staff has done, newest first — the admin's own review. */
export async function staffActions(limit = 100) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * What was done to one person's content.
 *
 * This is the half that makes the log mean something. A record only the
 * operator can read is an operator's convenience; a record the affected
 * person can read is accountability.
 */
export async function actionsOnMyContent(userId: string, limit = 20) {
  return prisma.auditLog.findMany({
    where: { targetOwnerId: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    // The actor's email is deliberately NOT selected. An artist should
    // know their piece was edited by staff; handing out a colleague's
    // address on a public-ish surface is a different decision, and not
    // one this view needs to make.
    select: {
      id: true,
      action: true,
      actorRole: true,
      summary: true,
      targetType: true,
      targetId: true,
      createdAt: true,
    },
  });
}

/** How many staff edits this person hasn't been shown yet, for a badge. */
export async function countActionsOnMyContent(userId: string, since?: Date | null) {
  return prisma.auditLog.count({
    where: {
      targetOwnerId: userId,
      ...(since ? { createdAt: { gt: since } } : {}),
    },
  });
}
