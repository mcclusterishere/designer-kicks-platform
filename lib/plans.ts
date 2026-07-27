/**
 * What's free, what's paid, and who can use what.
 *
 * The single source of truth for entitlement. Every gate in the app asks
 * this file rather than checking `plan === "PRO"` inline, because a
 * scattered check is how someone eventually ships a page that reads the
 * wrong field and gives the whole product away — or worse, locks out a
 * paying customer.
 *
 * THE LINE, and why it sits where it does:
 *
 * Everything cultural is free forever — posting, battles, the Heat List,
 * the Draft, drops, the artist's public page. That half is the funnel.
 * A platform with 24 artist pages and three claimed accounts does not
 * have a monetisation problem, it has a supply problem, and charging at
 * the door makes the supply problem permanent.
 *
 * What's paid is the business layer: the customer list, inventory and
 * P&L, their own domain, exports. Those are the tools that make a maker
 * money, which is the only honest thing to charge a maker for.
 */

export type PlanKey = "FREE" | "PRO";

export type Feature =
  | "contacts"
  | "inventory"
  | "ownDomain"
  | "exports"
  | "commissionPipeline"
  | "prioritySupport";

/** Everything a paid plan unlocks, in the words an artist would use. */
export const PRO_FEATURES: { key: Feature; label: string; blurb: string }[] = [
  {
    key: "contacts",
    label: "Your customer list",
    blurb:
      "Everyone who bought, asked, or landed in your phone — with what they spent and who's gone quiet. Import from your phone or Gmail.",
  },
  {
    key: "inventory",
    label: "Inventory & real margins",
    blurb:
      "Cost basis, fees, shipping, and what you actually cleared per pair. Not the number that feels good — the one that hit your account.",
  },
  {
    key: "ownDomain",
    label: "Your own site",
    blurb: "Your work on your own domain, running on our rails, with your name on it instead of ours.",
  },
  {
    key: "commissionPipeline",
    label: "Commission pipeline",
    blurb: "Quote, deposit, build stages, delivery — so nothing sits in a DM you forgot to answer.",
  },
  { key: "exports", label: "Export everything", blurb: "Your customers and sales as CSV, any time. It's your data." },
  { key: "prioritySupport", label: "Direct line", blurb: "You message us, a person answers." },
];

const ENTITLEMENTS: Record<PlanKey, Feature[]> = {
  FREE: [],
  PRO: PRO_FEATURES.map((f) => f.key),
};

/** Free for everyone, stated plainly so the paid page isn't a bait. */
export const FREE_FEATURES = [
  "Your artist page and closet",
  "Post as many pieces as you like",
  "Vote battles, the Heat List, tournaments",
  "The Draft and every game",
  "Drop calendar and the market",
  "Offers and messages from buyers",
];

/**
 * Default pricing. Overridable by env so a price change never needs a
 * deploy, and so a founding rate can be set per artist without touching
 * this file.
 */
export const PRICE_MONTHLY_CENTS = Number(process.env.PRO_MONTHLY_CENTS ?? 2900);
export const PRICE_YEARLY_CENTS = Number(process.env.PRO_YEARLY_CENTS ?? 29000);

/** What a year saves against paying monthly, as a whole number of months. */
export function yearlyMonthsFree(): number {
  if (PRICE_MONTHLY_CENTS <= 0) return 0;
  return Math.round((PRICE_MONTHLY_CENTS * 12 - PRICE_YEARLY_CENTS) / PRICE_MONTHLY_CENTS);
}

/** The shape every gate reads. Deliberately just the billing facts. */
export type Entitled = {
  plan: string;
  planStatus: string | null;
  paidThrough: Date | null;
};

/**
 * Does this artist have a live paid plan right now?
 *
 * Trusts `paidThrough`, not `planStatus`. A card that failed this morning
 * leaves Stripe in "past_due" while it retries for days — locking a maker
 * out of their own customer list over a retry that will probably succeed
 * is a good way to turn a billing hiccup into a cancellation. And an
 * artist who cancels keeps access until the period they already paid for
 * runs out, which is both fair and the law in several places.
 */
export function isPro(a: Entitled | null | undefined, now: Date = new Date()): boolean {
  if (!a) return false;
  if (a.plan !== "PRO") return false;
  // No end date on a PRO plan means a comped account — granted by hand in
  // the admin panel, and deliberately not time-limited.
  if (a.paidThrough === null) return true;
  return a.paidThrough.getTime() > now.getTime();
}

/** Can this artist use this feature? */
export function can(a: Entitled | null | undefined, feature: Feature, now: Date = new Date()): boolean {
  const plan: PlanKey = isPro(a, now) ? "PRO" : "FREE";
  return ENTITLEMENTS[plan].includes(feature);
}

/**
 * Billing needs attention — a real payment problem, as opposed to a
 * cancellation that simply runs its course. Surfaces a banner, never a
 * lockout.
 */
export function needsAttention(a: Entitled | null | undefined): boolean {
  if (!a || a.plan !== "PRO") return false;
  return a.planStatus === "past_due" || a.planStatus === "incomplete";
}

/** Days of paid access left, or null when it doesn't expire. */
export function daysLeft(a: Entitled | null | undefined, now: Date = new Date()): number | null {
  if (!a?.paidThrough) return null;
  const ms = a.paidThrough.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export function priceLabel(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}
