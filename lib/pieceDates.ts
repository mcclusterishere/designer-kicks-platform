/**
 * When a piece was commissioned, and when it dropped.
 *
 * createdAt only ever says when somebody got around to uploading. A
 * maker posting ten years of work needs the record to say when the work
 * happened, or the calendar is a history of our database rather than a
 * history of the craft.
 *
 * Both dates are optional on purpose. Nobody is blocked from posting
 * because they cannot remember what month a pair left the bench.
 *
 * Noon UTC is the house convention for a date-only input (the same one
 * announceArtistDrop and saveInventoryItem use): parsing a bare
 * YYYY-MM-DD as midnight puts it on the previous day for anybody west
 * of Greenwich, and this platform's makers are mostly in the US.
 */

export type PieceDates = { commissionedAt: Date | null; releasedAt: Date | null };

/** Sneakers did not exist as a custom scene before this, and a typo'd year is the usual cause of a date here. */
const EARLIEST = Date.parse("1970-01-01T00:00:00Z");
/** Announcing further out than this is a typo, not a plan. */
const FURTHEST_AHEAD_MS = 2 * 365 * 86_400_000;

function parseDay(raw: string): Date | null | "bad" {
  const t = raw.trim();
  if (!t) return null;
  const d = new Date(`${t}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "bad";
  return d;
}

export function parsePieceDates(
  commissionedRaw: string,
  releasedRaw: string,
  now: number = Date.now()
): { ok: true; dates: PieceDates } | { ok: false; error: string } {
  const commissionedAt = parseDay(commissionedRaw);
  if (commissionedAt === "bad") {
    return { ok: false, error: "That commission date isn't a real date — use the date picker." };
  }
  const releasedAt = parseDay(releasedRaw);
  if (releasedAt === "bad") {
    return { ok: false, error: "That release date isn't a real date — use the date picker." };
  }

  for (const [label, d] of [
    ["commission date", commissionedAt],
    ["release date", releasedAt],
  ] as const) {
    if (!d) continue;
    if (d.getTime() < EARLIEST) {
      return { ok: false, error: `That ${label} is before 1970 — check the year.` };
    }
    if (d.getTime() > now + FURTHEST_AHEAD_MS) {
      return { ok: false, error: `That ${label} is more than two years out — check the year.` };
    }
  }

  // You cannot finish before you start. This catches the common slip of
  // filling the two fields in the wrong order far more often than it
  // catches anybody lying.
  if (commissionedAt && releasedAt && releasedAt.getTime() < commissionedAt.getTime()) {
    return { ok: false, error: "The release date is before the commission date — swap them?" };
  }

  return { ok: true, dates: { commissionedAt, releasedAt } };
}

/** A piece whose release date hasn't arrived yet is an announcement, not a record. */
export function isUpcoming(releasedAt: Date | null, now: number = Date.now()): boolean {
  return Boolean(releasedAt && releasedAt.getTime() > now);
}

/** How a date renders everywhere on the site: UTC, so it reads the same for everyone. */
export function formatPieceDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
