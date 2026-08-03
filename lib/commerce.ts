import { prisma } from "./db";

/**
 * Whether the site brokers sales of custom pieces.
 *
 * Turned OFF as a deliberate legal posture, not a feature cut. Nike has
 * sued customizers — Warren Lotas settled after being unable to sell the
 * shoes he had produced, and the Drip Creationz complaint states in
 * terms that Nike "cannot allow customizers to build businesses off of
 * its famous trademarks." The through-line in those filings is COMMERCE
 * in altered goods carrying Nike's marks. Showing a maker's work, and
 * writing about it, is a different and far weaker target than running
 * the marketplace it sells through.
 *
 * So the pieces, the makers, the battles and the league all stay. What
 * stops is the site taking part in the transaction: offers, resale,
 * consignment, fees.
 *
 * This is a posture, not legal advice, and nobody here is a lawyer. It
 * reduces an exposure that is documented in public filings; it does not
 * make anything safe. A real opinion from a real IP attorney is worth
 * more than this comment.
 *
 * Backed by an AppSetting rather than an env var so the owner can flip
 * it from the admin without a redeploy — including flipping it back the
 * moment there is a lawyer's answer.
 */

const KEY = "customsSellingEnabled";

/** Default OFF. A missing row means nobody has turned it on. */
export async function customsSellingOn(): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
    return row?.value === "true";
  } catch {
    // A database hiccup must fail CLOSED here. Guessing "on" would let
    // the site broker a sale during an outage, which is the one outcome
    // this switch exists to prevent.
    return false;
  }
}

export async function setCustomsSelling(on: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: KEY },
    update: { value: on ? "true" : "false" },
    create: { key: KEY, value: on ? "true" : "false" },
  });
}

/** What a blocked action tells the person who tried. */
export const SELLING_OFF_MESSAGE =
  "Offers are closed. The Heat Chart shows and writes about custom work — it doesn't broker the sale. Reach the maker through their profile.";
