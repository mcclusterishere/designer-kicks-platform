"use server";

import Stripe from "stripe";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { PRICE_MONTHLY_CENTS, PRICE_YEARLY_CENTS } from "@/lib/plans";

/**
 * Subscription billing for artist Pro.
 *
 * Stripe stays the source of truth for money; the database mirrors just
 * enough to answer "can they use this" without a network call on every
 * page render. Every write that grants access happens in the webhook —
 * never on the success redirect — because a redirect is something a
 * browser can be pointed at and a signed webhook is not.
 */

function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Start a subscription. Returns an error string, or redirects to Stripe. */
export async function startSubscription(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?next=/pricing");

  const artist = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, stripeCustomerId: true, plan: true },
  });
  if (!artist) redirect("/submit");
  if (artist.plan === "PRO") redirect("/studio?billing=already");

  // The Founding 100 come before the checkout, not after it.
  //
  // While seats remain, reaching for Pro doesn't open a payment form at
  // all — it grants twelve months and a founding number. No card is
  // collected, so there is no subscription to cancel later and no way for
  // this to quietly start billing in a year.
  //
  // Ordered ahead of the Stripe branch deliberately: an artist should
  // never see a price, decide it's too much, and leave, while a free seat
  // with their name on it was sitting one line further down.
  const { claimFoundingSeat, foundingEmail } = await import("@/lib/founding");
  const claim = await claimFoundingSeat(artist.id);
  if (claim.ok) {
    if (!claim.alreadyHad) {
      // Fire-and-forget: a mail outage must not undo a grant that already
      // landed in the database. The Studio thanks them on screen anyway,
      // so the email is the keepsake rather than the notification.
      sendMail({
        to: session.user.email ?? "",
        ...foundingEmail({
          artistName: artist.displayName,
          number: claim.number,
          through: claim.through,
          siteUrl: siteBase(),
        }),
      }).catch(() => {});
    }
    revalidatePath("/pricing");
    revalidatePath("/studio");
    redirect(`/studio?founding=${claim.number}`);
  }

  const stripe = stripeClient();
  if (!stripe) redirect("/pricing?billing=unconfigured");

  const yearly = String(formData.get("interval") ?? "month") === "year";
  const unit = yearly ? PRICE_YEARLY_CENTS : PRICE_MONTHLY_CENTS;

  // Reuse the customer if there is one, so a returning artist doesn't
  // fragment into several Stripe customers and lose their invoice history.
  let customerId = artist.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: artist.displayName,
      metadata: { artistId: artist.id },
    });
    customerId = customer.id;
    await prisma.artistProfile.update({
      where: { id: artist.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: unit,
          recurring: { interval: yearly ? "year" : "month" },
          product_data: {
            name: "The Heat Chart — Artist Pro",
            description:
              "Customer list, inventory and real margins, your own site, and commission tracking.",
          },
        },
      },
    ],
    // The webhook reads these to know who to upgrade. Metadata on both
    // the session and the subscription, because the events that matter
    // later (renewals, cancellations) carry the subscription, not the
    // session.
    metadata: { artistId: artist.id },
    subscription_data: { metadata: { artistId: artist.id } },
    allow_promotion_codes: true,
    success_url: `${siteBase()}/studio?billing=live`,
    cancel_url: `${siteBase()}/pricing?billing=cancelled`,
  });

  redirect(checkout.url!);
}

/**
 * Send an artist to Stripe's own billing portal to change a card,
 * download invoices, or cancel.
 *
 * Cancelling belongs here rather than behind a support email. Making
 * someone ask a human to stop charging them is a dark pattern, and it's
 * the fastest way to earn a chargeback instead of a clean cancellation.
 */
export async function openBillingPortal(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?next=/studio");

  const artist = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  });
  const stripe = stripeClient();
  if (!stripe || !artist?.stripeCustomerId) redirect("/studio?billing=none");

  const portal = await stripe.billingPortal.sessions.create({
    customer: artist.stripeCustomerId,
    return_url: `${siteBase()}/studio`,
  });
  redirect(portal.url);
}
