import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/market";
import { RESALE_ARTIST_ROYALTY_PCT } from "@/lib/resale";
import CultureVerified from "@/components/CultureVerified";

/**
 * The draft-day letter, rebuilt for the artists who already made it.
 * Every "draft him to the league" comment thread ends here — and the
 * reader it's written for has followers, a full order book, and zero
 * patience for another platform asking for content. So the page opens
 * by conceding all of that, then makes the one pitch nobody else can:
 * every other app sells them MORE LABOR; the league turns the work
 * they already did into an asset that keeps paying. Tracked links
 * (/drafted?ref=code) credit the drafter automatically.
 */
export const metadata = {
  title: "You Got Drafted — The Heat Chart League",
  description:
    "You already won social media. The league is the part nobody offered: royalties on every resale of your work, a live market that prices it, and the paper trail that turns customs into capital. Free, no exclusivity.",
  openGraph: {
    title: "You Got Drafted — The Heat Chart League",
    description:
      "Commissions feed you today. Assets feed you forever. Here's what the league actually does for artists who already have the orders.",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

// The movement pitch — each one a thing NO other platform offers a
// customizer. Ordered by how fast the money shows up.
const ORIGINALS = [
  {
    n: "01",
    title: `${RESALE_ARTIST_ROYALTY_PCT}% royalty on every resale — forever`,
    body: "When a piece you made re-trades on our market, you get paid again. And again. Etsy doesn't do this. eBay doesn't. StockX doesn't. Instagram definitely doesn't. Your 2022 work becomes 2026 income, and every collector flipping your pieces is working for you.",
  },
  {
    n: "02",
    title: "A live market prices your work",
    body: "Standing bids, a Heat Index that moves with votes and sales, verified comps. Stop guessing what to charge in DMs — post the ask, watch the bids, sell at the high one with one tap. Price discovery is what turned sneakers into a market; now it's pointed at YOUR work.",
  },
  {
    n: "03",
    title: "Your old work becomes new money",
    body: "Consignment relists: a pair you sold for short money years ago comes back, relists with its history on the record, and resells at what you're worth NOW — split with your collector so they win too. Your back catalog is inventory you forgot you had.",
  },
  {
    n: "04",
    title: "Customs as capital",
    body: "Provenance ledger, portfolio statement, valuation methodology, an independent USPAP appraiser network. This is the paper trail fine artists use to insure, appraise, and borrow against their work — built for customizers for the first time anywhere.",
  },
  {
    n: "05",
    title: "A commission inbox with budgets attached",
    body: "Fans pick the base pair, name a budget, pitch the idea — you accept or pass with one tap. The base ships to you. No more twelve-message DM negotiations that die at the price.",
  },
  {
    n: "06",
    title: "Distribution you don't have to run",
    body: "Every piece you post auto-publishes to the league's feed and social channels the moment it clears review. Your drops go on the same calendar our readers check for Jordan dates. The league's whole job is making its artists bigger.",
  },
];

const STEPS = [
  { n: "1", t: "You got drafted", b: "Someone in the culture called your name. No applications, no gatekeepers — the culture scouts." },
  { n: "2", t: "Claim your page", b: "Your page may already be staged from your public work. Five minutes: bio, links, your shops connected. Culture Verified stamp when it's really you." },
  { n: "3", t: "Post pieces, set asks", b: "Your hardest pairs go up priced. Battles put them in front of voters; the market puts bids under them." },
  { n: "4", t: "Get paid on every layer", b: "Commissions in the inbox, sales at your ask or the high bid, royalties when your work re-trades, and a portfolio that compounds underneath it all." },
];

export default async function DraftedPage() {
  // Live receipts + the draft-class wall — proof the league is real,
  // pulled fresh on every load.
  const [artists, pieces, votes, verifiedSales, roster] = await Promise.all([
    prisma.artistProfile.count({ where: { status: "APPROVED" } }),
    prisma.submission.count({ where: { status: "APPROVED" } }),
    prisma.vote.count(),
    prisma.sale.aggregate({ where: { status: "CONFIRMED", verified: true }, _sum: { priceCents: true } }),
    prisma.submission.findMany({
      where: { status: "APPROVED", category: "sneakers" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true, title: true, imageUrl: true, artistName: true,
        artist: { select: { slug: true } },
      },
    }),
  ]);
  const verifiedVolume = verifiedSales._sum.priceCents ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* The letter */}
      <div className="text-center">
        <CultureVerified detail="Draft Notice" />
        <h1 className="display mt-4 text-5xl text-white sm:text-6xl">
          You Got <span className="text-gradient-volt">Drafted.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-smoke">
          Somebody saw your work and called your name. That&apos;s how it
          starts here — no applications, no gatekeepers. The culture scouts,
          and right now it&apos;s telling us{" "}
          <span className="font-bold text-white">you belong in the league</span>.
        </p>
      </div>

      {/* Level with them first — this reader already won */}
      <div className="mt-12 rounded-2xl border border-edge bg-surface p-6 sm:p-8">
        <div className="rule w-16" />
        <h2 className="display mt-3 text-3xl text-white">
          Let&apos;s be honest about what you already have
        </h2>
        <p className="mt-3 text-smoke">
          The following. The full order book. The pricing you fought your way
          to. You built that without us, and nothing on this page pretends
          otherwise. Another app promising &quot;exposure&quot; is an insult —
          exposure is the one thing you&apos;re not short on.
        </p>
        <p className="mt-3 text-smoke">
          So here&apos;s the actual pitch:{" "}
          <span className="font-bold text-white">
            commissions feed you today. Assets feed you forever.
          </span>{" "}
          Every platform you&apos;re on sells you more orders — more labor,
          more hours, more paint. The league is the first one built to make
          the work you <span className="text-white">already did</span> keep
          paying you: royalties, resale, provenance, capital. That layer
          doesn&apos;t exist anywhere else in this culture. That&apos;s the
          movement.
        </p>
      </div>

      {/* Watch it instead of reading it — the closet film */}
      <div className="mt-12 grid items-center gap-6 rounded-2xl border border-edge bg-surface p-6 sm:grid-cols-[200px_1fr] sm:p-8">
        <video
          src="https://d8j0ntlcm91z4.cloudfront.net/user_3G3F7jiUHPTPLSNf3XP0bAYtQmG/hf_20260721_213443_bd25e005-62d2-4f61-8052-fe1c36006adb.mp4"
          poster="/ad-refs/artist.png"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="mx-auto aspect-[9/16] w-40 rounded-xl border border-edge bg-black object-cover sm:w-full"
        />
        <div>
          <p className="tag text-volt">Watch: your closet, as a portfolio</p>
          <p className="mt-2 text-smoke">
            That&apos;s an artist page on the league — every piece cataloged,
            heat-rank badges earned in battle, and a standing bid pulsing on
            the work. This is what &quot;assets feed you forever&quot; looks
            like on screen.
          </p>
          <Link
            href="/dk/artist"
            className="tag mt-3 inline-block text-volt underline underline-offset-4"
          >
            The shot-by-shot breakdown →
          </Link>
        </div>
      </div>

      {/* The originals — what nobody else offers */}
      <div className="mt-12">
        <h2 className="display text-center text-3xl text-white">
          Six Things <span className="text-gradient-volt">Nobody Else Offers You</span>
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {ORIGINALS.map((g) => (
            <div key={g.n} className="rounded-2xl border border-edge bg-surface p-5">
              <p className="tag text-volt">{g.n}</p>
              <h3 className="display mt-1 text-xl text-white">{g.title}</h3>
              <p className="mt-2 text-sm text-smoke">{g.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* The terms — kill the catch before they look for it */}
      <div className="mt-8 rounded-xl border border-volt/40 bg-volt/10 p-5">
        <h3 className="display text-center text-xl text-white">And the catch is — there isn&apos;t one</h3>
        <ul className="mx-auto mt-3 max-w-xl space-y-1.5 text-sm text-smoke">
          <li>
            <span className="font-bold text-white">No exclusivity.</span> Keep the Etsy, the site,
            the DMs — we link buyers straight to them. The league is a stage, not a cage.
          </li>
          <li>
            <span className="font-bold text-white">Free for artists, forever.</span> When on-platform
            checkout opens, the primary fee is 1%. Elsewhere you&apos;re paying 8–13%.
          </li>
          <li>
            <span className="font-bold text-white">Your work stays yours.</span> Copyright, images,
            client list — all yours. We record provenance; we don&apos;t own product.
          </li>
        </ul>
      </div>

      {/* Live receipts */}
      <div className="mt-12 overflow-x-auto rounded-lg border border-edge bg-surface">
        <div className="flex min-w-max divide-x divide-edge text-center">
          {[
            { label: "Artists On The Chart", value: artists.toLocaleString("en-US") },
            { label: "Pieces Catalogued", value: pieces.toLocaleString("en-US") },
            { label: "Votes Cast", value: votes.toLocaleString("en-US") },
            { label: "Verified Volume", value: verifiedVolume > 0 ? formatUsd(verifiedVolume) : "Opening" },
          ].map((s) => (
            <div key={s.label} className="flex-1 px-5 py-3">
              <p className="text-lg font-bold tabular-nums text-white">{s.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-smoke">{s.label}</p>
            </div>
          ))}
        </div>
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
          Claim your page or post your two hardest pairs. Five minutes, your
          phone&apos;s camera roll — and your catalog starts compounding.
        </p>
        <div className="mx-auto mt-6 grid max-w-sm gap-2">
          <Link href="/artists" className="btn-hard block rounded-xl py-3.5 tag font-bold">
            My Page Is Already Up — Claim It
          </Link>
          <Link href="/submit" className="btn-hard-volt block rounded-xl py-3.5 tag font-bold">
            Accept — Submit My Pairs
          </Link>
          <Link
            href="/art-capital"
            className="block rounded-xl border border-edge py-3.5 tag text-smoke transition hover:border-volt hover:text-white"
          >
            Read The Art-Capital Program First
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
