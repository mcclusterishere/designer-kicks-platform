import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { cultureIQ, AMBASSADOR_MIN_IQ } from "@/lib/iq";
import AmbassadorApplyForm from "@/components/AmbassadorApplyForm";

export const metadata = {
  title: "Ambassador Program — Free Shoots, Real Credit | The Heat Chart",
  description:
    "Models: free professional shoots with top sneaker customizers, credited posts to 300k+, and a path to running curation for the league. The quiz is the door — fashion knowledge required.",
  openGraph: {
    title: "The Heat Chart Ambassador Program",
    description:
      "Free shoots. Real credit. The shoot is the audition, the quiz is the door, and the top of the board becomes curators.",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

/**
 * The ambassador funnel — where every automated Threads post lands.
 * Three audiences, one loop: models get free shoots (the shoot IS the
 * audition), customizers get their pieces shot free, and the league
 * gets the culture on camera. The Culture IQ gate is the filter that
 * makes "must understand fashion" enforceable instead of aspirational —
 * and it converts every applicant into an active app user before
 * they've shot a single frame.
 */

const LADDER = [
  {
    tier: "Prospect",
    body: "Make your account, clear the culture check, apply with your city. You're in the pool — the league books city by city.",
  },
  {
    tier: "Ambassador",
    body: "Booked for shoots: one-of-one customs, real photographers, zero cost to you. Full credit everywhere the shots run — the site, the feed, channels with 300k+ reach. The shoot is your audition; the shots are yours to keep using.",
  },
  {
    tier: "Curator",
    body: "The superuser class, picked from the top of the Culture IQ board among active ambassadors. Curators get first pick of shoots, drops, and events — and a voice in what the league features. The most opportunities go to the people who know the most and show up.",
  },
];

export default async function AmbassadorsPage() {
  const session = await auth();
  const me = session?.user?.id
    ? {
        iq: (await cultureIQ(session.user.id)).iq,
        application: await prisma.ambassadorApplication.findUnique({
          where: { userId: session.user.id },
          select: { status: true },
        }),
      }
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="tag text-volt">The League · Ambassador Program</p>
      <h1 className="display mt-2 text-5xl text-white sm:text-6xl">
        Stop paying for <span className="text-gradient-volt">portfolio shoots.</span>
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-smoke">
        The league shoots one-of-one custom sneakers in every city it
        touches — and models shoot free.{" "}
        <span className="text-white">The shoot is the audition.</span> Your
        shots run credited on the platform and channels with 300k+ reach,
        and the ones who know the culture best graduate to running it.
      </p>

      {/* The deal, three ways */}
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-edge bg-surface p-5">
          <p className="tag text-volt">Models</p>
          <p className="mt-2 text-sm leading-relaxed text-smoke">
            Free professional shoots, full credit, shots you keep. No
            &quot;exposure&quot; math — real portfolio work with real product.
          </p>
        </div>
        <div className="rounded-2xl border border-edge bg-surface p-5">
          <p className="tag text-heat">Customizers</p>
          <p className="mt-2 text-sm leading-relaxed text-smoke">
            Your pieces shot free by the league when we&apos;re in your city —
            campaign-grade images for your page, your market listings, your socials.
          </p>
        </div>
        <div className="rounded-2xl border border-edge bg-surface p-5">
          <p className="tag text-smoke">The League</p>
          <p className="mt-2 text-sm leading-relaxed text-smoke">
            The culture on camera, everybody credited, everybody eating.
            That&apos;s the whole model.
          </p>
        </div>
      </div>

      {/* The ladder */}
      <h2 className="display mt-12 text-3xl text-white">The ladder</h2>
      <div className="mt-4 space-y-3">
        {LADDER.map((l, i) => (
          <div key={l.tier} className="flex gap-4 rounded-2xl border border-edge bg-surface p-5">
            <span className="display shrink-0 text-4xl text-volt">{i + 1}</span>
            <div>
              <h3 className="display text-lg text-white">{l.tier}</h3>
              <p className="mt-1 text-sm leading-relaxed text-smoke">{l.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* The door */}
      <div className="mt-10 rounded-xl border border-volt/40 bg-volt/5 p-5">
        <h2 className="display text-xl text-white">The quiz is the door — on purpose</h2>
        <p className="mt-2 text-sm leading-relaxed text-smoke">
          Understanding fashion is the prerequisite, and the{" "}
          <Link href="/quiz" className="text-volt underline">Heat Check</Link>{" "}
          is how you prove it: clear{" "}
          <span className="font-bold tabular-nums text-white">{AMBASSADOR_MIN_IQ} Culture IQ</span>{" "}
          to apply. Every right answer is +2. Curators are picked from the
          top of the board — so the score that gets you in is the same score
          that moves you up.
        </p>
      </div>

      {/* Apply */}
      <h2 className="display mt-12 text-3xl text-white">Apply</h2>
      <div className="mt-4 rounded-xl border border-edge bg-surface p-6">
        {me ? (
          <AmbassadorApplyForm
            iq={me.iq}
            minIq={AMBASSADOR_MIN_IQ}
            alreadyApplied={Boolean(me.application)}
          />
        ) : (
          <div className="text-center">
            <p className="text-sm text-smoke">
              The program runs through the app — account first, then the
              culture check, then the application.
            </p>
            <div className="mx-auto mt-4 grid max-w-sm gap-2">
              <Link href="/register" className="btn-hard block rounded-xl py-3.5 tag font-bold">
                Create Account
              </Link>
              <Link
                href="/signin"
                className="block rounded-xl border border-edge py-3.5 tag text-white transition hover:border-volt"
              >
                Sign In
              </Link>
            </div>
          </div>
        )}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-smoke/70">
        Shoots are unpaid collaborations: models receive professional images,
        full credit, and program standing; customizers receive campaign
        imagery of their pieces. Nobody is charged, and shots are always
        credited. Members only — the{" "}
        <Link href="/equity-uprise" className="underline">Equity Uprise membership</Link>{" "}
        covers the program.
      </p>
    </div>
  );
}
