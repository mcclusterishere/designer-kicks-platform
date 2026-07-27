import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { grantCredits, PACK_SIZE } from "@/lib/quiz";

/**
 * Stripe's side of the story.
 *
 * Two products arrive here: one-off credit packs for the quiz, and
 * artist Pro subscriptions. Both grant access, so both are granted ONLY
 * from a signature-verified event — never from a success redirect, which
 * is just a URL a browser can be pointed at.
 */

/** Mirror a subscription's state onto the artist it belongs to. */
async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  // Prefer the metadata we set at checkout; fall back to the customer id
  // so a subscription created in the Stripe dashboard still lands.
  const artistId = sub.metadata?.artistId;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const artist = artistId
    ? await prisma.artistProfile.findUnique({ where: { id: artistId }, select: { id: true, firstSubscribedAt: true } })
    : await prisma.artistProfile.findUnique({
        where: { stripeCustomerId: customerId },
        select: { id: true, firstSubscribedAt: true },
      });
  if (!artist) return;

  const item = sub.items.data[0];
  const priceCents = item?.price.unit_amount ?? null;
  const interval = item?.price.recurring?.interval ?? null;

  // current_period_end is the instant access runs to. It's the only field
  // the entitlement gate trusts, so a cancelled subscriber keeps what
  // they paid for and a failed card doesn't lock anyone out mid-retry.
  const periodEndUnix =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    item?.current_period_end;
  const paidThrough = periodEndUnix ? new Date(periodEndUnix * 1000) : null;

  // "PRO" stays set even while canceled — isPro() reads paidThrough for
  // the actual decision, so downgrading the label early would revoke
  // access someone already paid for.
  const stillEntitled = paidThrough !== null && paidThrough.getTime() > Date.now();
  const active = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";

  await prisma.artistProfile.update({
    where: { id: artist.id },
    data: {
      plan: active || stillEntitled ? "PRO" : "FREE",
      planStatus: sub.status,
      planPriceCents: priceCents,
      planInterval: interval,
      paidThrough,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      // Stamped once, ever. Cohort maths breaks if a churned-and-returned
      // artist resets their own start date.
      firstSubscribedAt: artist.firstSubscribedAt ?? new Date(),
    },
  });
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  }

  const stripe = new Stripe(stripeKey);
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Subscriptions are handled by their own events below — fetching
      // the subscription here keeps the upgrade instant rather than
      // waiting for the next lifecycle event to arrive.
      if (session.mode === "subscription" && session.subscription) {
        const id =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await syncSubscription(await stripe.subscriptions.retrieve(id));
        break;
      }
      // One-off credit packs.
      const userId = session.metadata?.userId;
      const packs = Number(session.metadata?.packs ?? 1);
      if (userId && session.payment_status === "paid") {
        const already = await prisma.creditTransaction.findUnique({
          where: { stripeSessionId: session.id },
        });
        if (!already) {
          await grantCredits(userId, packs * PACK_SIZE, "purchase", session.id);
        }
      }
      break;
    }

    // Renewals, upgrades, cancellations, failed cards. Every one of them
    // is the same operation: take Stripe's current truth and mirror it.
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;

    // A renewal that succeeded — re-read the subscription so paidThrough
    // moves forward. Without this, access silently expires on renewal day
    // for a customer who paid on time.
    case "invoice.paid": {
      const invoice = event.data.object as unknown as { subscription?: string | { id: string } };
      const subRef = invoice.subscription;
      if (subRef) {
        const id = typeof subRef === "string" ? subRef : subRef.id;
        await syncSubscription(await stripe.subscriptions.retrieve(id));
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
