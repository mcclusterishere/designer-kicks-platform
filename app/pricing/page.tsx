import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  PRO_FEATURES,
  FREE_FEATURES,
  PRICE_MONTHLY_CENTS,
  PRICE_YEARLY_CENTS,
  priceLabel,
  yearlyMonthsFree,
  isPro,
} from "@/lib/plans";
import { startSubscription } from "@/app/billing-actions";
import { foundingSeatsLeft, FOUNDING_SEATS, FOUNDING_MONTHS } from "@/lib/founding";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Artist Pro — Run Your Custom Business | The Heat Chart",
  description:
    "Your customer list, real margins on every pair, and your own site — on the same rails that run The Heat Chart. Posting, battles and the Heat List stay free forever.",
};

export default async function PricingPage() {
  const session = await auth();
  const artist = session?.user?.id
    ? await prisma.artistProfile.findUnique({
        where: { userId: session.user.id },
        select: { plan: true, planStatus: true, paidThrough: true, status: true },
      })
    : null;
  const already = isPro(artist);
  const monthsFree = yearlyMonthsFree();
  const seatsLeft = await foundingSeatsLeft();

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <p className="tag text-volt">For makers</p>
      <h1 className="display mt-2 text-5xl text-white">
        The culture stays <span className="text-volt">free</span>.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-smoke">
        Posting your work, battling for the chart, the Draft, the drop calendar — free, and
        staying free. What costs money is the part that runs your business: knowing who your
        customers are, what you actually cleared on a pair, and having a site with your name on
        it instead of ours.
      </p>

      {/* The Founding 100. Shown only while seats exist — an expired offer
          left on a pricing page is worse than no offer, because it tells
          every artist who reads it that they arrived too late. */}
      {seatsLeft > 0 && !already && (
        <div className="mt-8 rounded-2xl border-2 border-volt bg-volt/[0.07] p-6">
          <p className="tag text-volt">The Founding {FOUNDING_SEATS}</p>
          <h2 className="display mt-1 text-3xl text-white">
            The first {FOUNDING_SEATS} artists get Pro free for {FOUNDING_MONTHS} months.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-smoke">
            Not a trial — a thank-you. Backing a platform before it&apos;s obvious is the hard
            version, and the people who do it first are the reason there&apos;s anything here for
            anyone else to join. No card, no subscription, nothing to remember to cancel.
          </p>
          <p className="mt-3 tag text-volt">
            {seatsLeft} of {FOUNDING_SEATS} {seatsLeft === 1 ? "seat" : "seats"} left
          </p>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Free, described properly rather than as a crippled teaser. */}
        <div className="rounded-2xl border border-edge bg-surface p-6">
          <p className="tag text-smoke">Always free</p>
          <p className="display mt-1 text-4xl text-white">$0</p>
          <p className="mt-2 text-sm text-smoke">
            Everything that makes you known. No card, no expiry, no catch.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-smoke">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-volt">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/submit"
            className="mt-6 block rounded-lg border border-edge py-3 text-center tag font-bold text-white transition hover:border-volt"
          >
            Post a piece
          </Link>
        </div>

        {/* Pro */}
        <div className="glow-volt rounded-2xl border border-volt bg-volt/5 p-6">
          <div className="flex items-baseline justify-between">
            <p className="tag text-volt">Artist Pro</p>
            {monthsFree > 0 && (
              <p className="tag text-smoke">
                {monthsFree} month{monthsFree === 1 ? "" : "s"} free on a year
              </p>
            )}
          </div>
          <p className="display mt-1 text-4xl text-white">
            {priceLabel(PRICE_MONTHLY_CENTS)}
            <span className="text-lg text-smoke">/month</span>
          </p>
          <p className="mt-2 text-sm text-smoke">
            {/* Explicit space: JSX drops the one in the source when the
                expression and the words after it wrap to separate lines,
                and this rendered as "$290a year" on the live pricing page. */}
            Or {priceLabel(PRICE_YEARLY_CENTS)}{" "}
            a year. Cancel whenever — you keep access through what you&apos;ve already paid for.
          </p>

          <ul className="mt-5 space-y-3 text-sm">
            {PRO_FEATURES.map((f) => (
              <li key={f.key}>
                <p className="flex gap-2 font-bold text-white">
                  <span className="text-volt">✓</span>
                  {f.label}
                </p>
                <p className="ml-5 text-xs text-smoke">{f.blurb}</p>
              </li>
            ))}
          </ul>

          {already ? (
            <p className="mt-6 rounded-lg border border-volt/50 bg-volt/10 px-4 py-3 text-center text-sm text-volt">
              You&apos;re on Pro. Manage billing from the Studio.
            </p>
          ) : artist?.status !== "APPROVED" ? (
            <div className="mt-6">
              <Link
                href="/submit"
                className="block rounded-lg btn-hard py-3 text-center tag font-bold"
              >
                Get an artist account first
              </Link>
              <p className="mt-2 text-center text-xs text-smoke">
                Pro is for approved artists — apply free, it takes a minute.
              </p>
            </div>
          ) : seatsLeft > 0 ? (
            /* While seats remain there is exactly one button, and it does
               not mention a price, because there isn't one to pay. Two
               buttons here — one free, one $29 — would just be a puzzle. */
            <div className="mt-6">
              <form action={startSubscription}>
                <input type="hidden" name="interval" value="month" />
                <button className="w-full rounded-lg btn-hard py-3.5 tag font-bold glow-volt">
                  Claim your free year
                </button>
              </form>
              <p className="mt-2 text-center text-xs text-smoke">
                No card, nothing to cancel — we never take a payment method for this.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              <form action={startSubscription}>
                <input type="hidden" name="interval" value="month" />
                <button className="w-full rounded-lg btn-hard py-3 tag font-bold">
                  Go Pro — {priceLabel(PRICE_MONTHLY_CENTS)}/mo
                </button>
              </form>
              <form action={startSubscription}>
                <input type="hidden" name="interval" value="year" />
                <button className="w-full rounded-lg border border-volt py-3 tag font-bold text-volt transition hover:bg-volt/10">
                  Pay yearly — {priceLabel(PRICE_YEARLY_CENTS)}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <section className="mt-12 rounded-xl border border-edge bg-surface p-6">
        <h2 className="display text-xl text-white">Straight answers</h2>
        <dl className="mt-4 space-y-4 text-sm">
          {[
            [
              "What happens to my work if I stop paying?",
              "Nothing. Your pieces, your page, your battle record and your standing on the chart are all free features and they stay exactly where they are. You lose the business tools — the customer list stays in your account, you just can't open it until you're back on Pro. We never delete it.",
            ],
            [
              "Can I get my data out?",
              "Yes, any time, as CSV. Your customers and your sales are yours. Software that holds your customer list hostage isn't a tool, it's a trap.",
            ],
            [
              "Is my customer list visible to other artists?",
              "No. Contacts are scoped to you. Two makers who know the same collector each keep their own record, with their own notes — nobody sees anybody else's book, including us in any way that shows up on the site.",
            ],
            [
              "What if my card fails?",
              "Nothing locks immediately. Stripe retries for several days and you keep working the whole time — we'll just show you a banner. A billing hiccup shouldn't cost you access to your own customers.",
            ],
            [
              "How do I cancel?",
              "One button in the Studio, straight into Stripe's own billing page. No email, no phone call, no talking anyone out of it.",
            ],
          ].map(([q, a]) => (
            <div key={q}>
              <dt className="font-bold text-white">{q}</dt>
              <dd className="mt-1 text-smoke">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-8 text-center text-xs text-smoke">
        Prices in USD. Billing runs on Stripe — we never see or store your card.
      </p>
    </div>
  );
}
