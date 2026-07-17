import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { grantCredits, PACK_SIZE } from "@/lib/quiz";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
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
  }

  return NextResponse.json({ received: true });
}
