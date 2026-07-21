import Link from "next/link";
import { prisma } from "@/lib/db";
import CultureVerified from "@/components/CultureVerified";

/**
 * The draft-day letter. This is the page the outreach campaign points
 * at — every "somebody draft him to the league" comment thread ends
 * here. It has one job: make a customizer feel SEEN, explain what the
 * league actually does for them, and hand them the pen.
 * Share it with a tracked link (/drafted?ref=yourcode) and the traffic
 * layer credits the drafter automatically.
 */
export const metadata = {
  title: "You Got Drafted — The Heat Chart League",
  description:
    "The culture called your name. The Heat Chart is the custom-sneaker battle league: your own artist page, battles the culture votes on, the Heat List, buyers sent straight to your shop — free for artists, forever.",
  openGraph: {
    title: "You Got Drafted — The Heat Chart League",
    description:
      "Somebody drafted you to the league. Here's what that means — and what happens next.",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

const GIVES = [
  {
    n: "01",
    title: "Your own page in the league",
    body: "A pro artist profile: your pieces, your story, your followers, your Heat Score. Claim it and it wears the Culture Verified stamp — proof there's a real maker behind the work.",
  },
  {
    n: "02",
    title: "Battles the culture votes on",
    body: "Your hardest pairs go head-to-head with other makers. Real votes, real rankings, no judges' table. Winning climbs you up the Heat List — the league table of custom sneaker culture.",
  },
  {
    n: "03",
    title: "Buyers sent to YOUR shop",
    body: "Your Etsy, your site, your DMs — we link buyers straight to wherever you already sell. Your money stays your money. We're the stage, not the middleman.",
  },
  {
    n: "04",
    title: "Your drops on the calendar",
    body: "Announce a release and it goes on the same drop calendar our readers check for Jordan and Nike dates. Your custom drop, listed next to the big dogs.",
  },
  {
    n: "05",
    title: "The selling playbook",
    body: "Pricing help, listing help, how-to-sell education in the artist portal — built for makers who are great with paint and tired of guessing on business.",
  },
  {
    n: "06",
    title: "The content machine",
    body: "Winners and standout pieces get pushed across our channels — articles, socials, the feed. The league's whole job is making its artists famous.",
  },
];

const STEPS = [
  { n: "1", t: "You got drafted", b: "Someone in the culture called your name — that's how everyone gets here. No applications from us, no gatekeepers. The culture scouts." },
  { n: "2", t: "Your first pieces go up", b: "Send us 2 of your hardest pairs (5–6 angles each) — or we may have already staged your page from your public work. Either way, you approve everything." },
  { n: "3", t: "You claim your page", b: "One tap, you own it: your bio, your links, your shop. The Culture Verified stamp goes on when it's really you." },
  { n: "4", t: "First battle", b: "We match you against another maker in your division. The culture votes. Win or lose, thousands of sneakerheads meet your work." },
  { n: "5", t: "Climb", b: "Heat List rank, tournaments, followers, buyers. The artists at the top aren't lucky — they kept posting pairs." },
];

export default async function DraftedPage() {
  // Social proof: the newest names on the roster — the draft class wall.
  const roster = await prisma.submission.findMany({
    where: { status: "APPROVED", category: "sneakers" },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true, title: true, imageUrl: true, artistName: true,
      artist: { select: { slug: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* The letter */}
      <div className="text-center">
        <CultureVerified detail="Draft Notice" />
        <h1 className="display mt-4 text-5xl text-white sm:text-6xl">
          You Got <span className="text-gradient-volt">Drafted.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-smoke">
          Somebody saw your work and called your name. That&apos;s how it starts
          here — no applications, no gatekeepers. The culture scouts, the
          culture votes, and right now the culture is telling us{" "}
          <span className="font-bold text-white">you belong in the league</span>.
        </p>
      </div>

      {/* What the league is */}
      <div className="mt-12 rounded-2xl border border-edge bg-surface p-6 sm:p-8">
        <div className="rule w-16" />
        <h2 className="display mt-3 text-3xl text-white">What The League Is</h2>
        <p className="mt-3 text-smoke">
          The Heat Chart is the <span className="text-white">custom-sneaker battle league</span> —
          the place where independent customizers stop being &quot;a page with
          nice pictures&quot; and start having a record. Artists put their
          hardest pairs up, the culture votes them into rank on the Heat List,
          and the winners get the spotlight, the followers, and the buyers.
        </p>
        <p className="mt-3 text-smoke">
          The purpose is simple: <span className="text-white">custom sneaker
          culture deserves a major league</span> — one that belongs to the
          makers, not to a brand. Built by McCluster Corp&apos;s Equity Uprise
          project; grown out of the Designer Kicks community.
        </p>
      </div>

      {/* What we do for you */}
      <div className="mt-12">
        <h2 className="display text-center text-3xl text-white">
          What The League Does <span className="text-gradient-volt">For You</span>
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {GIVES.map((g) => (
            <div key={g.n} className="rounded-2xl border border-edge bg-surface p-5">
              <p className="tag text-volt">{g.n}</p>
              <h3 className="display mt-1 text-xl text-white">{g.title}</h3>
              <p className="mt-2 text-sm text-smoke">{g.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-xl border border-volt/40 bg-volt/10 p-4 text-center text-sm text-white">
          <span className="font-bold">What it costs you: nothing.</span>{" "}
          <span className="text-smoke">
            Free for artists, forever. When our own checkout opens, the seller
            fee is 1% — until then we just point buyers at your shop.
          </span>
        </p>
      </div>

      {/* How draft day works */}
      <div className="mt-12">
        <h2 className="display text-center text-3xl text-white">How Draft Day Works</h2>
        <div className="mt-6 space-y-3">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-4 rounded-2xl border border-edge bg-surface p-5">
              <span className="display shrink-0 text-4xl text-volt">{s.n}</span>
              <div>
                <h3 className="display text-lg text-white">{s.t}</h3>
                <p className="mt-1 text-sm text-smoke">{s.b}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The draft class wall */}
      {roster.length > 0 && (
        <div className="mt-12">
          <h2 className="display text-center text-3xl text-white">
            The Latest <span className="text-gradient-heat">Draft Class</span>
          </h2>
          <p className="mt-2 text-center text-sm text-smoke">
            Makers already on the chart — your future opponents.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {roster.map((p) => (
              <Link
                key={p.id}
                href={p.artist?.slug ? `/artists/${p.artist.slug}` : "/heat-list"}
                className="card-lift group overflow-hidden rounded-xl border border-edge bg-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={`${p.title} by ${p.artistName}`} loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                <div className="p-2.5">
                  <p className="line-clamp-1 text-sm font-bold text-white group-hover:text-volt">{p.title}</p>
                  <p className="tag mt-0.5 text-smoke">{p.artistName}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Accept the draft */}
      <div className="mt-12 rounded-3xl border border-volt/40 bg-surface p-8 text-center shadow-2xl">
        <h2 className="display text-3xl text-white">Accept The Draft</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-smoke">
          Send your two hardest pairs and take your spot. Five minutes,
          your phone&apos;s camera roll, done.
        </p>
        <div className="mx-auto mt-6 grid max-w-sm gap-2">
          <Link href="/submit" className="btn-hard block rounded-xl py-3.5 tag font-bold">
            Accept — Submit My Pairs
          </Link>
          <Link href="/artists" className="btn-hard-volt block rounded-xl py-3.5 tag font-bold">
            My Page Is Already Up — Claim It
          </Link>
        </div>
        <p className="mt-4 text-xs text-smoke/70">
          Questions first? DM{" "}
          <a href="https://instagram.com/kickequipped" target="_blank" rel="noopener noreferrer" className="text-volt underline">
            the league
          </a>{" "}
          — a human answers.
        </p>
      </div>
    </div>
  );
}
