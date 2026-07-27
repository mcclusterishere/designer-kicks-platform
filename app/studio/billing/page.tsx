import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isPro, daysLeft, needsAttention, priceLabel, PRICE_MONTHLY_CENTS } from "@/lib/plans";
import { openBillingPortal } from "@/app/billing-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing — The Heat Chart Studio" };

/**
 * Billing, with the cancel button in plain sight.
 *
 * Making someone email a human to stop being charged is a dark pattern
 * and a reliable way to earn a chargeback instead of a clean
 * cancellation. Stripe's own portal handles the card, the invoices and
 * the cancellation; this page just gets people there without a fight.
 */
export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?next=/studio/billing");

  const artist = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      status: true,
      plan: true,
      planStatus: true,
      planPriceCents: true,
      planInterval: true,
      paidThrough: true,
      stripeCustomerId: true,
    },
  });
  if (!artist || artist.status !== "APPROVED") redirect("/submit");

  const pro = isPro(artist);
  const left = daysLeft(artist);
  const trouble = needsAttention(artist);
  const cancelling = artist.planStatus === "canceled" && pro;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="tag text-volt">Studio</p>
      <h1 className="display mt-1 text-4xl text-white">Billing</h1>
      <Link href="/studio" className="mt-2 inline-block tag text-smoke underline hover:text-white">
        ← Back to the Studio
      </Link>

      <div className="mt-6 rounded-xl border border-edge bg-surface p-5">
        <p className="tag text-smoke">Current plan</p>
        <p className="display mt-1 text-3xl text-white">
          {pro ? "Artist Pro" : "Free"}
        </p>

        {pro && artist.planPriceCents && (
          <p className="mt-1 text-sm text-smoke">
            {priceLabel(artist.planPriceCents)} per {artist.planInterval ?? "month"}
          </p>
        )}

        {cancelling ? (
          <p className="mt-3 rounded-lg border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
            Cancelled — you keep Pro for another {left} {left === 1 ? "day" : "days"}, through the
            period you already paid for. Nothing gets deleted after that; your customer list waits
            for you.
          </p>
        ) : trouble ? (
          <p className="mt-3 rounded-lg border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
            Your last payment didn&apos;t go through and Stripe is retrying. You still have full
            access — update the card below when you get a chance.
          </p>
        ) : pro && left !== null ? (
          <p className="mt-3 text-sm text-smoke">Renews in {left} {left === 1 ? "day" : "days"}.</p>
        ) : pro ? (
          <p className="mt-3 text-sm text-smoke">Comped — no billing on this account.</p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {artist.stripeCustomerId ? (
            <form action={openBillingPortal}>
              <button className="rounded-lg btn-hard px-5 py-2.5 tag font-bold">
                Manage card, invoices &amp; cancel
              </button>
            </form>
          ) : (
            <Link href="/pricing" className="rounded-lg btn-hard px-5 py-2.5 tag font-bold">
              See Artist Pro — {priceLabel(PRICE_MONTHLY_CENTS)}/mo
            </Link>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-smoke">
        Payments run through Stripe. We never see or store your card details. Cancelling is one
        button and takes effect at the end of the period you&apos;ve paid for — we don&apos;t
        prorate away time you already bought, and we don&apos;t ask you to email anyone.
      </p>
    </div>
  );
}
