import { prisma } from "./db";

/**
 * Who has the piece.
 *
 * Provenance is the product. A one-of-one with no known owner is a photo;
 * a one-of-one with a verified owner is an asset with a resale value, a
 * collector page, and a second sale in it. Everything on the market side
 * of this platform depends on knowing the answer.
 *
 * The answer is asked ONCE, at upload, as a single question. That
 * placement is deliberate: asked later it never gets asked at all, and
 * asked as a wall of required fields it stops people uploading. The
 * common case — a maker posting work they still have — costs one radio
 * button and nothing else.
 */

export const OWNERSHIP = {
  WITH_ARTIST: "WITH_ARTIST",
  SOLD: "SOLD",
  UNKNOWN: "UNKNOWN",
} as const;
export type OwnershipStatus = (typeof OWNERSHIP)[keyof typeof OWNERSHIP];

export type OwnerInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export function validEmail(s: string): boolean {
  return /^[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}$/.test(s.trim());
}

/** Digits only; null when it clearly isn't a number. */
export function cleanPhone(s: string): string | null {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

/**
 * Check an ownership answer before it's written.
 *
 * Returns the fields to store, or a message. A piece the artist still
 * holds needs nothing — the moment that stops being true is the moment
 * this starts asking.
 */
export function validateOwnership(
  status: string,
  owner: OwnerInput
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (status === OWNERSHIP.WITH_ARTIST) {
    // Explicitly clear any stale owner from a previous answer, so a piece
    // that comes back from a cancelled sale doesn't keep a phantom owner.
    return {
      ok: true,
      data: {
        ownershipStatus: OWNERSHIP.WITH_ARTIST,
        ownerEmail: null, ownerPhone: null, ownerAddress: null, ownerName: null,
        ownerVerifiedAt: null, ownerVerifiedBy: null,
      },
    };
  }

  if (status !== OWNERSHIP.SOLD) {
    return { ok: false, error: "Say whether you still have the piece or someone else does." };
  }

  const email = (owner.email ?? "").trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "The owner's email — it's how they claim the piece and prove it's theirs." };
  }
  if (!validEmail(email)) return { ok: false, error: "That owner email doesn't look right." };

  return {
    ok: true,
    data: {
      ownershipStatus: OWNERSHIP.SOLD,
      ownerEmail: email,
      ownerPhone: cleanPhone(owner.phone ?? ""),
      // Optional by design — see the schema comment. Trimmed and capped.
      ownerAddress: (owner.address ?? "").trim().slice(0, 300) || null,
      ownerName: (owner.name ?? "").trim().slice(0, 120) || null,
    },
  };
}

/**
 * The scope for "a piece I made AND still hold".
 *
 * Authorship is not authority. `artistId` is the credit line and it is
 * permanent — it never moves, and it shouldn't. `ownerId` is the thing
 * that moves, and once it has, the maker is no longer the person whose
 * call it is what the piece costs, what it says about itself, or whether
 * it goes on existing.
 *
 * The write actions in the Studio all used to scope on `artistId` alone,
 * which quietly meant a maker kept full write access to a one-of-one for
 * the rest of its life: re-price a pair sitting in a collector's closet,
 * rewrite its description, re-point who owns it, or delete it outright
 * and take the collector's sale record, offers and ratings down with it
 * in the cascade.
 *
 * Two deliberate details:
 *
 *   - This is a WHERE fragment, meant to be spread into the query, not a
 *     check run after the read. Ownership verified after loading a row is
 *     ownership that can be forgotten on the next branch; ownership in
 *     the query cannot be.
 *   - A CONFIRMED sale disqualifies the piece even when `ownerId` is
 *     null. A buyer deleting their account SetNulls that column, and a
 *     collector closing their account must not hand their pair back to
 *     the person who made it.
 */
export function stillHeldBy(artistId: string, pieceId: string) {
  return {
    id: pieceId,
    artistId,
    ownerId: null,
    sales: { none: { status: "CONFIRMED" } },
  } as const;
}

export const PIECE_HAS_MOVED_ON =
  "That piece is in a collector's closet now — the owner controls its listing and its record. Your name stays on it forever; the decisions don't. If something looks wrong, message us and we'll sort it out with them.";

/**
 * Who may record the next sale of a piece: whoever is holding it.
 *
 * Returns null when nobody can — a CONFIRMED sale whose buyer has since
 * deleted their account leaves a pair with no rightful seller, and that
 * is an admin's problem to unpick, not an opening for the maker to take
 * it back.
 */
export function holderOf(piece: {
  ownerId: string | null;
  artist?: { userId: string | null } | null;
  sales: { status: string }[];
}): string | null {
  if (piece.ownerId) return piece.ownerId;
  if (piece.sales.some((s) => s.status === "CONFIRMED")) return null;
  return piece.artist?.userId ?? null;
}

/**
 * Pieces whose ownership question is still outstanding.
 *
 * Everything uploaded before the question existed is UNKNOWN. That's a
 * backlog to work through, not a default state — an artist answering it
 * takes two seconds per piece and turns a photo into a provenance record.
 */
export async function unansweredPieces(artistId: string, limit = 100) {
  return prisma.submission.findMany({
    where: { artistId, ownershipStatus: OWNERSHIP.UNKNOWN, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, title: true, imageUrl: true, size: true, createdAt: true },
  });
}

/** Owners named by an artist but not yet confirmed by anybody. */
export async function unverifiedOwners(limit = 100) {
  const rows = await prisma.submission.findMany({
    where: {
      ownershipStatus: OWNERSHIP.SOLD,
      ownerEmail: { not: null },
      ownerVerifiedAt: null,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true, title: true, imageUrl: true, createdAt: true,
      ownerEmail: true, ownerPhone: true, ownerName: true,
      artistName: true, artist: { select: { slug: true, displayName: true } },
    },
  });
  const now = Date.now();
  return rows.map((r) => ({
    ...r,
    daysWaiting: Math.max(0, Math.round((now - r.createdAt.getTime()) / 86400000)),
  }));
}

/** How the whole provenance backlog stands, for one artist. */
export async function ownershipStats(artistId: string) {
  const [withArtist, sold, unknown, verified] = await Promise.all([
    prisma.submission.count({ where: { artistId, status: "APPROVED", ownershipStatus: OWNERSHIP.WITH_ARTIST } }),
    prisma.submission.count({ where: { artistId, status: "APPROVED", ownershipStatus: OWNERSHIP.SOLD } }),
    prisma.submission.count({ where: { artistId, status: "APPROVED", ownershipStatus: OWNERSHIP.UNKNOWN } }),
    prisma.submission.count({ where: { artistId, status: "APPROVED", ownerVerifiedAt: { not: null } } }),
  ]);
  return { withArtist, sold, unknown, verified, total: withArtist + sold + unknown };
}

/** The letter an owner gets when an artist names them. */
export function ownerVerifyEmail(opts: {
  title: string;
  artistName: string;
  verifyUrl: string;
}): { subject: string; text: string } {
  return {
    subject: `${opts.artistName} listed you as the owner of "${opts.title}"`,
    text: [
      `${opts.artistName} recorded that you own "${opts.title}" — a one-of-one they made.`,
      ``,
      `Confirm it here and the piece is officially logged to you:`,
      opts.verifyUrl,
      ``,
      `Free, takes a minute, and it gets you:`,
      `  · a collector page with the piece and your name on it`,
      `  · verified provenance — the public record shows you own this exact one`,
      `  · a real resale value, and the ability to sell it on when you want`,
      ``,
      `If this isn't yours, ignore this and nothing happens — we won't list you.`,
      ``,
      `— The Heat Chart`,
    ].join("\n"),
  };
}
