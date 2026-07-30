import { prisma } from "./db";

/**
 * Clearing out the accounts that were never people.
 *
 * The site carries three very different kinds of account and they look
 * alike in a list, which is exactly how a cleanup turns into a disaster:
 *
 *   DEMO      — seeded fixtures and test rows. Never a person. Safe to
 *               destroy, and the reason the roster looks padded.
 *   ROSTER    — real artists whose work was researched and pre-loaded for
 *               outreach, who haven't logged in YET. Deleting these is
 *               deleting the actual product: they are the customs a
 *               visitor comes to look at.
 *   CLAIMED   — somebody set a password or signed in with Google/Facebook.
 *               A real person with real work. Never touched here.
 *
 * "Unclaimed" is NOT the same as "fake", and conflating them is the
 * expensive mistake available in this file. Every pre-loaded artist page
 * is unclaimed by definition until its artist walks in.
 *
 * WHY DELETION HAS TO BE EXPLICIT ABOUT PIECES
 *
 * Submission.artist is onDelete: SetNull, not Cascade. So deleting a user
 * destroys their ArtistProfile (that relation IS Cascade) and leaves every
 * piece they posted alive with artistId = null — still in the market,
 * still in battles, still carrying a denormalised artistName, and now
 * linking to an artist page that returns 404. A naive purge doesn't clean
 * the site up; it fills it with ghosts. So pieces are removed on purpose,
 * in order, rather than left to a cascade that was never going to fire.
 */

/** Addresses that can only be fixtures. */
const DEMO_EMAIL = [
  /^demo\+/i,
  /@test\.example$/i,
  /@example\.invalid$/i,
  /@example\.com$/i, // reserved by RFC 2606 — never a real mailbox
  /^e2e[-.]/i,
  /^verify-[a-z]+-/i,
  /^claim-debug@/i,
  /^lg-\d+@/i,
];

export type AccountKind = "demo" | "roster" | "claimed" | "staff";

export type AccountRow = {
  userId: string;
  email: string;
  name: string | null;
  kind: AccountKind;
  why: string;
  artistSlug: string | null;
  artistName: string | null;
  pieces: number;
  votesOnTheirPieces: number;
  salesInvolved: number;
  foundingNumber: number | null;
};

function looksLikeFixture(email: string, slug: string | null): boolean {
  if (DEMO_EMAIL.some((re) => re.test(email))) return true;
  if (slug && /^(e2e|verify|test|claim-debug|claim-artist|league-test|lg-)/.test(slug)) return true;
  if (slug === "test-customs-co") return true;
  return false;
}

/**
 * Every account, sorted into the three piles, with what a delete would cost.
 *
 * Read-only on purpose. Nothing in this module deletes anything a human
 * hasn't looked at first — the whole point is that the list is reviewed
 * BEFORE it's acted on, because there is no undo underneath it.
 */
export async function classifyAccounts(): Promise<AccountRow[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      _count: { select: { accounts: true } },
      artistProfile: {
        select: {
          slug: true,
          displayName: true,
          foundingNumber: true,
          _count: { select: { submissions: true } },
          submissions: { select: { _count: { select: { votes: true } } } },
        },
      },
      salesSold: { select: { id: true } },
      salesBought: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return users.map((u) => {
    const claimed = Boolean(u.passwordHash) || u._count.accounts > 0;
    const slug = u.artistProfile?.slug ?? null;
    const votes = (u.artistProfile?.submissions ?? []).reduce((t, s) => t + s._count.votes, 0);

    let kind: AccountKind;
    let why: string;
    if (u.role && u.role.toUpperCase() !== "MEMBER") {
      kind = "staff";
      why = `Staff account (${u.role})`;
    } else if (claimed) {
      kind = "claimed";
      why = u.passwordHash ? "Set a password" : "Signed in with Google/Facebook";
    } else if (looksLikeFixture(u.email, slug)) {
      kind = "demo";
      why = "Seeded fixture or test row — never a person";
    } else {
      kind = "roster";
      why = "Real artist, pre-loaded for outreach, hasn't logged in yet";
    }

    return {
      userId: u.id,
      email: u.email,
      name: u.name,
      kind,
      why,
      artistSlug: slug,
      artistName: u.artistProfile?.displayName ?? null,
      pieces: u.artistProfile?._count.submissions ?? 0,
      votesOnTheirPieces: votes,
      salesInvolved: u.salesSold.length + u.salesBought.length,
      foundingNumber: u.artistProfile?.foundingNumber ?? null,
    };
  });
}

export type PurgeResult =
  | { ok: true; usersDeleted: number; piecesDeleted: number; profilesDeleted: number }
  | { ok: false; error: string };

/**
 * Destroy the accounts named, and everything hanging off them.
 *
 * Irreversible. Guarded four ways, and every guard is here because the
 * consequence of skipping it is somebody's work gone for good:
 *
 *   - refuses anything not classified DEMO unless `allowRoster` is set,
 *     so the default can never take a real artist by accident;
 *   - refuses a claimed account outright, no override — that is a person
 *     who logged in, and nothing in an admin panel should be able to
 *     delete them by mistake;
 *   - refuses staff;
 *   - refuses a founding seat holder, because a seat is a promise with a
 *     number in it and deleting one silently renumbers nothing but
 *     leaves a gap in a hundred.
 *
 * Pieces are deleted FIRST and explicitly. See the note at the top: the
 * schema would otherwise orphan them into the live market.
 */
export async function purgeAccounts(
  userIds: string[],
  opts: { allowRoster?: boolean } = {}
): Promise<PurgeResult> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return { ok: false, error: "Nothing selected." };

  const all = await classifyAccounts();
  const chosen = all.filter((a) => ids.includes(a.userId));
  if (chosen.length !== ids.length) {
    return { ok: false, error: "One of those accounts no longer exists — reload and try again." };
  }

  const claimed = chosen.find((c) => c.kind === "claimed");
  if (claimed) {
    return { ok: false, error: `${claimed.email} has actually logged in. Claimed accounts are never deleted here.` };
  }
  const staff = chosen.find((c) => c.kind === "staff");
  if (staff) return { ok: false, error: `${staff.email} is a staff account. Remove the role first.` };

  const founder = chosen.find((c) => c.foundingNumber !== null);
  if (founder) {
    return { ok: false, error: `${founder.artistName ?? founder.email} holds Founding seat #${founder.foundingNumber}. Deleting it would leave a hole in the hundred.` };
  }
  if (!opts.allowRoster) {
    const roster = chosen.find((c) => c.kind === "roster");
    if (roster) {
      return {
        ok: false,
        error: `${roster.artistName ?? roster.email} is a real artist who hasn't logged in yet, not a test row. Tick "include real unclaimed artists" if you truly mean to delete their work.`,
      };
    }
  }

  const profiles = await prisma.artistProfile.findMany({
    where: { userId: { in: ids } },
    select: { id: true },
  });
  const profileIds = profiles.map((p) => p.id);

  // A piece the purged account only OWNS is somebody else's work. A test
  // collector who "bought" a real artist's shoe must not take that shoe
  // with them — the piece goes back to its artist, which is what a null
  // ownerId means everywhere else in the codebase.
  await prisma.submission.updateMany({
    where: { ownerId: { in: ids }, NOT: { artistId: { in: profileIds } } },
    data: { ownerId: null },
  });

  // Pieces they MADE, deleted by hand. onDelete: SetNull on
  // Submission.artist means the cascade would otherwise leave these alive
  // and authorless in the live market, linking to a 404.
  const pieces = await prisma.submission.findMany({
    where: { artistId: { in: profileIds } },
    select: { id: true },
  });
  const pieceIds = pieces.map((p) => p.id);

  const { deleteSubmissionsCascade } = await import("./purgeCascade");
  await deleteSubmissionsCascade(pieceIds);

  await prisma.artistProfile.deleteMany({ where: { id: { in: profileIds } } });
  const gone = await prisma.user.deleteMany({ where: { id: { in: ids } } });

  return {
    ok: true,
    usersDeleted: gone.count,
    piecesDeleted: pieceIds.length,
    profilesDeleted: profileIds.length,
  };
}
