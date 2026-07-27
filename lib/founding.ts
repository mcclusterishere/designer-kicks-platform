import { prisma } from "./db";

/**
 * The Founding 100.
 *
 * The first hundred artists who reach for Pro don't get a checkout — they
 * get twelve months of it, free, and a number that says they were here
 * first. That is the whole offer, and the reasoning behind it is worth
 * writing down because it looks like giving away revenue and isn't:
 *
 * A platform with two dozen artist pages doesn't have a monetisation
 * problem, it has a supply problem. Charging the first hundred makers to
 * show up converts a small number of them into small money and the rest
 * into nobody. Giving them a year converts all of them into a roster,
 * and a roster is the thing the paid product is eventually sold on.
 *
 * Twelve months is also long enough to be a real gift rather than a
 * trial. Nobody builds their customer list inside a tool they expect to
 * lose in thirty days.
 *
 * WHAT THIS IS NOT: it is not a trial, and nothing here says "trial" to
 * an artist. A trial is something you have to escape before it bills you.
 * This bills nobody — there is no card, no Stripe customer, and no
 * subscription behind it, so there is nothing to cancel and nothing that
 * can silently start charging in a year. When the twelve months end the
 * plan simply stops being Pro, exactly the way a lapsed plan does, and
 * every cultural feature keeps working the way it always did.
 */

/** Seats. Deliberately a constant: "the Founding 100" is the offer. */
export const FOUNDING_SEATS = 100;

/** How long the seat is good for. */
export const FOUNDING_MONTHS = 12;

/**
 * Add whole months without the 31st-of-January problem.
 *
 * Naively setting month + 12 on the 29th of February lands on the 1st of
 * March in a non-leap year, which quietly shortens the gift by a day. Not
 * a large injustice, but a promise of twelve months should be twelve
 * months, so the day is clamped to the last valid one of the target month.
 */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export type FoundingClaim =
  | { ok: true; number: number; through: Date; alreadyHad: boolean }
  | { ok: false; reason: "full" | "not-approved" | "already-pro" };

/**
 * Take a seat, if there is one.
 *
 * The cap is enforced by the unique index on `foundingNumber`, not by the
 * count — the count only decides whether to try. Under two simultaneous
 * claims both may compute the same next number; one write wins, the other
 * comes back around, re-counts, and either takes the next seat or finds
 * the room full. That is why this retries rather than locking: a brief
 * collision on a button two people tapped at once is not worth holding a
 * table lock for, and the index makes the outcome correct either way.
 *
 * Idempotent: an artist who already has a number gets it back unchanged,
 * with `alreadyHad` set, and their twelve months are NOT extended. Double
 * -tapping a button must never be a way to earn a second year.
 */
export async function claimFoundingSeat(
  artistId: string,
  now: Date = new Date()
): Promise<FoundingClaim> {
  const artist = await prisma.artistProfile.findUnique({
    where: { id: artistId },
    select: {
      id: true,
      status: true,
      plan: true,
      paidThrough: true,
      foundingNumber: true,
      firstSubscribedAt: true,
    },
  });
  if (!artist) return { ok: false, reason: "not-approved" };

  // Already one of them — hand back the same seat, change nothing.
  if (artist.foundingNumber !== null) {
    const through = artist.paidThrough ?? addMonths(now, FOUNDING_MONTHS);
    return { ok: true, number: artist.foundingNumber, through, alreadyHad: true };
  }

  if (artist.status !== "APPROVED") return { ok: false, reason: "not-approved" };

  // A comped or paying account doesn't need a seat and shouldn't burn
  // one — those are scarce and this artist already has the thing it buys.
  if (artist.plan === "PRO" && (artist.paidThrough === null || artist.paidThrough > now)) {
    return { ok: false, reason: "already-pro" };
  }

  const through = addMonths(now, FOUNDING_MONTHS);

  for (let attempt = 0; attempt < 6; attempt++) {
    const taken = await prisma.artistProfile.count({
      where: { foundingNumber: { not: null } },
    });
    if (taken >= FOUNDING_SEATS) return { ok: false, reason: "full" };

    try {
      await prisma.artistProfile.update({
        where: { id: artist.id },
        data: {
          foundingNumber: taken + 1,
          foundingGrantedAt: now,
          plan: "PRO",
          // Not "active": nothing is billing. A status that reads like a
          // live subscription would make the SaaS numbers lie about
          // revenue, and those numbers are the reason to build this.
          planStatus: "founding",
          planPriceCents: 0,
          planInterval: null,
          paidThrough: through,
          firstSubscribedAt: artist.firstSubscribedAt ?? now,
        },
      });
      return { ok: true, number: taken + 1, through, alreadyHad: false };
    } catch (e) {
      // Somebody else took that number in the gap. Go again.
      const code = (e as { code?: string })?.code;
      if (code !== "P2002") throw e;
    }
  }
  // Six collisions means genuine contention, not a bug. Refusing is
  // honest; the artist can tap again and the room is probably full.
  return { ok: false, reason: "full" };
}

/** How many seats are left. Never negative, never above the cap. */
export async function foundingSeatsLeft(): Promise<number> {
  const taken = await prisma.artistProfile.count({
    where: { foundingNumber: { not: null } },
  });
  return Math.max(0, FOUNDING_SEATS - taken);
}

/**
 * The thank-you.
 *
 * Written to a person who took a chance on an empty room, because that is
 * what they did. No upsell, no countdown, no "your trial expires" — the
 * date is stated plainly once and then it gets out of the way.
 */
export function foundingEmail(input: {
  artistName: string;
  number: number;
  through: Date;
  siteUrl: string;
}): { subject: string; text: string } {
  const when = input.through.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const base = input.siteUrl.replace(/\/$/, "");
  return {
    subject: `You're Founding Artist #${input.number} — Pro is on us for a year`,
    text:
      `${input.artistName},\n\n` +
      `You're one of the first ${FOUNDING_SEATS} artists on The Heat Chart, and that's not a small thing. ` +
      `Backing something before it's obvious is the hard version.\n\n` +
      `You're Founding Artist #${input.number}. Artist Pro is yours free for twelve months — through ${when}. ` +
      `That's the customer list, inventory and real margins, the commission pipeline, exports, and a direct line to us.\n\n` +
      `There's no card on file and nothing to cancel. We can't charge you: we never took a payment method. ` +
      `When the year is up, Pro simply stops unless you decide otherwise — and your page, your pieces, your battle record ` +
      `and everything else stay exactly where they are, free, the way they always were.\n\n` +
      `Your Studio: ${base}/studio\n\n` +
      `Thank you. Genuinely.\n\n` +
      `— The Heat Chart`,
  };
}
