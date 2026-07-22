import Link from "next/link";
import localFont from "next/font/local";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/market";
import { RESALE_ARTIST_ROYALTY_PCT } from "@/lib/resale";
import Reveal from "@/components/Reveal";

export const metadata = {
  title: "You Got Drafted — The Heat Chart Scouting Department",
  description:
    "The league drafts customizers like an agency signs talent: your closet becomes a portfolio, your work becomes assets, and every resale pays you again. The draft is open.",
  openGraph: {
    title: "You Got Drafted — The Heat Chart",
    description:
      "Commissions feed you today. Assets feed you forever. The league is recruiting.",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

// The athletics department: Anton is the poster voice (one weight,
// all muscle), Archivo carries body copy at weights that never read
// thin. Both self-hosted — no network at build.
const sport = localFont({
  src: "../../public/fonts/Anton.ttf",
  weight: "400",
  variable: "--font-sport",
  display: "swap",
});
const grotesk = localFont({
  src: "../../public/fonts/Archivo.ttf",
  weight: "100 900",
  variable: "--font-grotesk",
  display: "swap",
});

/**
 * The scouting-department page — agency-format recruitment: hero with
 * media collage and floating proof chips, live receipts strip, the
 * league map as destination cards, an editorial split, the first-week
 * itinerary, a receipts marquee, and the big signing-day banner. Every
 * section reveals on scroll; every campaign asset works a shift.
 */

const DESTINATIONS = [
  {
    video: "/ad-videos/arena2.mp4",
    poster: "/ad-refs/arena2.jpg",
    tag: "01 · The Arena",
    title: "Battle for rank",
    body: "Your pieces go head-to-head. The culture votes. Wins write your record.",
    href: "/battles",
    cta: "Enter the arena",
  },
  {
    video: null,
    poster: "/ad-refs/exchange2.jpg",
    tag: "02 · The Exchange",
    title: "Price your work",
    body: "Asks, live bids, sell-now — and a Heat Index that moves when you win.",
    href: "/market",
    cta: "See the board",
  },
  {
    video: null,
    poster: "/ad-refs/standings2.jpg",
    tag: "03 · The Standings",
    title: "Climb the table",
    body: "Every artist ranked by wins, votes, and verified sales. No bought spots.",
    href: "/heat-list",
    cta: "Check the rankings",
  },
  {
    video: "/ad-videos/gallery.mp4",
    poster: "/ad-refs/gallery.jpg",
    tag: "04 · The Vault",
    title: "Work becomes assets",
    body: `Provenance on every piece — and a ${RESALE_ARTIST_ROYALTY_PCT}% royalty back to you on every resale. Forever.`,
    href: "/art-capital",
    cta: "How the money works",
  },
];

const ITINERARY = [
  { n: "Day 1", title: "Accept the draft", body: "Free account, two minutes. You're on the roster." },
  { n: "Day 2", title: "Build your closet", body: "Upload your best pieces — each one becomes a cataloged, priceable asset with your name on the ledger." },
  { n: "Day 3", title: "Enter a battle", body: "First matchup goes on your record. Votes start feeding your Heat Index." },
  { n: "Day 4", title: "Set your asks", body: "Price your work like the market it is. Bids come to you." },
  { n: "Forever", title: "Get paid again", body: `Every future resale of your work sends ${RESALE_ARTIST_ROYALTY_PCT}% back to you. That's the part nobody else offers.` },
];

export default async function DraftedPage() {
  // Live receipts — proof the league is real, pulled fresh each load.
  const [artists, pieces, votes, verifiedSales, roster] = await Promise.all([
    prisma.artistProfile.count({ where: { status: "APPROVED" } }),
    prisma.submission.count({ where: { status: "APPROVED" } }),
    prisma.vote.count(),
    prisma.sale.aggregate({ where: { status: "CONFIRMED", verified: true }, _sum: { priceCents: true } }),
    prisma.submission.findMany({
      where: { status: "APPROVED", category: "sneakers", askingPriceCents: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, imageUrl: true, artistName: true, askingPriceCents: true },
    }),
  ]);
  const verifiedVolume = verifiedSales._sum.priceCents ?? 0;
  const stats = [
    { k: "Artists on the roster", v: String(artists) },
    { k: "Pieces cataloged", v: String(pieces) },
    { k: "Votes cast", v: votes.toLocaleString("en-US") },
    { k: "Verified volume", v: formatUsd(verifiedVolume) },
  ];

  return (
    <div className={`${sport.variable} ${grotesk.variable} drafted-sport`} style={{ fontFamily: "var(--font-grotesk), var(--font-geist-sans), sans-serif", fontWeight: 500 }}>
      {/* ── Hero: the signing offer, shot on the block ── */}
      <section className="relative overflow-hidden">
        <video
          src="/ad-videos/verdict.mp4"
          poster="/ad-refs/verdict.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-ink" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
          <div>
            <Reveal>
              <p className="tag text-volt">The Heat Chart · Scouting Department</p>
            </Reveal>
            <Reveal delay={90}>
              <h1
                className="mt-4 text-7xl uppercase leading-[0.88] text-white sm:text-8xl lg:text-9xl"
                style={{ fontFamily: "var(--font-sport)" }}
              >
                You&apos;ve
                <br />
                been
                <br />
                <span className="text-gradient-volt">scouted.</span>
              </h1>
            </Reveal>
            <Reveal delay={180}>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-smoke">
                Somebody saw your work and called your name. The league signs
                customizers the way an agency signs talent: your closet becomes
                a portfolio, your pieces become assets — and the work you
                already did keeps paying you.
              </p>
            </Reveal>
            <Reveal delay={270}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register?ref=drafted" className="btn-hard rounded-full px-7 py-3.5 tag font-bold">
                  Accept the Draft
                </Link>
                <a
                  href="#tape"
                  className="rounded-full border border-edge px-7 py-3.5 tag text-white transition hover:border-volt"
                >
                  Watch the Tape
                </a>
              </div>
            </Reveal>
            <Reveal delay={360}>
              <p className="tag mt-6 text-smoke">
                Free to join · No exclusivity · Your shops stay yours
              </p>
            </Reveal>
          </div>

          {/* Proof chips ride the film */}
          <div className="relative hidden min-h-72 lg:block">
            <div className="float-slow absolute right-12 top-10 rounded-full border border-volt/50 bg-ink/85 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg">
              {RESALE_ARTIST_ROYALTY_PCT}% royalty · every resale
            </div>
            <div className="float-slower absolute bottom-16 right-0 rounded-full border border-heat/50 bg-ink/85 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg">
              HX · your own live index
            </div>
          </div>
        </div>
      </section>

      {/* ── Film room: the tape, two-up ── */}
      <section id="tape" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-14">
        <Reveal>
          <p className="tag text-volt">Film room</p>
          <h2 className="mt-2 text-4xl uppercase text-white sm:text-5xl" style={{ fontFamily: "var(--font-sport)" }}>
            Watch the tape
          </h2>
        </Reveal>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
          <Reveal from="left" delay={100}>
            <video
              src="/ad-videos/artist.mp4"
              poster="/ad-refs/artist.png"
              autoPlay muted loop playsInline preload="metadata"
              className="aspect-[9/16] w-full rounded-2xl border border-edge object-cover shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
            />
          </Reveal>
          <Reveal from="right" delay={200}>
            <video
              src="/ad-videos/trader.mp4"
              poster="/ad-refs/trader.jpg"
              autoPlay muted loop playsInline preload="metadata"
              className="aspect-[9/16] w-full rounded-2xl border border-edge object-cover shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
            />
          </Reveal>
        </div>
      </section>

      {/* ── Receipts strip ── */}
      <section className="border-y border-edge bg-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-edge sm:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.k} delay={i * 90} className="px-5 py-6 text-center">
              <p className="text-4xl tabular-nums text-white sm:text-5xl" style={{ fontFamily: "var(--font-sport)" }}>{s.v}</p>
              <p className="tag mt-1 text-smoke">{s.k}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── The league map — destination cards ── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <p className="tag text-volt">Where you&apos;re headed</p>
          <h2 className="mt-2 text-4xl uppercase text-white sm:text-5xl" style={{ fontFamily: "var(--font-sport)" }}>The league map</h2>
        </Reveal>
        <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {DESTINATIONS.map((d, i) => (
            <Reveal key={d.href} delay={i * 110} from="up" className="w-72 shrink-0 snap-start lg:w-auto">
              <Link
                href={d.href}
                className="card-lift group block overflow-hidden rounded-2xl border border-edge bg-surface"
              >
                <div className="relative">
                  {d.video ? (
                    <video
                      src={d.video}
                      poster={d.poster}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="none"
                      className="aspect-[4/5] w-full object-cover opacity-90 transition group-hover:opacity-100"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={d.poster}
                      alt={d.title}
                      className="aspect-[4/5] w-full object-cover object-top opacity-90 transition group-hover:opacity-100"
                    />
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-ink/85 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    {d.tag}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-2xl uppercase text-white" style={{ fontFamily: "var(--font-sport)" }}>{d.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-smoke">{d.body}</p>
                  <p className="tag mt-3 text-volt">{d.cta} →</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Editorial split: the pitch ── */}
      <section className="border-y border-edge bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2">
          <Reveal from="left">
            <video
              src="/ad-videos/notforcheap.mp4"
              poster="/ad-refs/notforcheap.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              className="mx-auto aspect-[9/16] w-full max-w-sm rounded-2xl border border-edge object-cover shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
            />
          </Reveal>
          <div>
            <Reveal>
              <p className="tag text-heat">The honest pitch</p>
              <h2 className="mt-2 text-4xl uppercase leading-[0.95] text-white sm:text-5xl" style={{ fontFamily: "var(--font-sport)" }}>
                Commissions feed you today. <span className="text-gradient-heat">Assets feed you forever.</span>
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-4 max-w-lg leading-relaxed text-smoke">
                You built the following, the order book, the pricing — without
                us. Every other platform sells you more labor. The league is
                the first built to make the work you{" "}
                <span className="font-bold text-white">already did</span> keep
                paying you:
              </p>
            </Reveal>
            <div className="mt-6 space-y-3">
              {[
                "A provenance ledger under every piece — who made it, who owns it, what it sold for",
                "A live bid book — collectors bring money to you",
                `${RESALE_ARTIST_ROYALTY_PCT}% royalty on every future resale, automatically`,
                "A Heat Index that turns your wins into a number lenders and buyers can read",
              ].map((line, i) => (
                <Reveal key={line} delay={i * 100} from="left">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-volt text-[11px] font-bold text-ink">
                      ✓
                    </span>
                    <p className="text-sm leading-relaxed text-smoke">{line}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── The itinerary: your first week ── */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <Reveal>
          <p className="tag text-volt">The onboarding itinerary</p>
          <h2 className="mt-2 text-4xl uppercase text-white sm:text-5xl" style={{ fontFamily: "var(--font-sport)" }}>Your first week in the league</h2>
        </Reveal>
        <div className="mt-8 space-y-3">
          {ITINERARY.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <div className="flex items-start gap-4 rounded-2xl border border-edge bg-surface p-5">
                <span className="sticker shrink-0 rounded px-2.5 py-1 text-xs">{s.n}</span>
                <div>
                  <h3 className="text-xl uppercase text-white" style={{ fontFamily: "var(--font-sport)" }}>{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-smoke">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200}>
          <p className="mt-6 text-sm text-smoke">
            Models and photographers get drafted too — through the{" "}
            <Link href="/ambassadors" className="text-volt underline">ambassador program</Link>.
            Appraisers, the{" "}
            <Link href="/appraisers" className="text-volt underline">independent network</Link>{" "}
            is open.
          </p>
        </Reveal>
      </section>

      {/* ── Receipts marquee: real pieces, real asks ── */}
      {roster.length >= 3 && (
        <section className="overflow-hidden border-y border-edge bg-surface py-8">
          <Reveal className="mx-auto max-w-6xl px-4">
            <p className="tag text-smoke">On the board right now</p>
          </Reveal>
          <div className="marquee-x mt-5 gap-4 pl-4">
            {[...roster, ...roster].map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="flex w-64 shrink-0 items-center gap-3 rounded-2xl border border-edge bg-panel/60 p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.title} className="h-14 w-14 rounded-xl border border-edge object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{p.title}</p>
                  <p className="truncate text-xs text-smoke">{p.artistName}</p>
                  <p className="text-sm font-bold tabular-nums text-volt">
                    {p.askingPriceCents ? formatUsd(p.askingPriceCents) : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Signing day — the big banner ── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal from="scale">
          <div className="relative overflow-hidden rounded-3xl border border-volt/40">
            <video
              src="/ad-videos/sting.mp4"
              poster="/ad-refs/sting.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/60" />
            <div className="relative px-6 py-16 text-center sm:py-20">
              <p className="tag text-volt">Signing day</p>
              <h2 className="mt-3 text-6xl uppercase text-white sm:text-7xl" style={{ fontFamily: "var(--font-sport)" }}>
                The draft is <span className="text-gradient-volt">open.</span>
              </h2>
              <p className="mx-auto mt-3 max-w-md text-smoke">
                Free to join. Nothing exclusive. Your name on the board by tonight.
              </p>
              <div className="mx-auto mt-7 flex max-w-md flex-col justify-center gap-3 sm:flex-row">
                <Link href="/register?ref=drafted" className="btn-hard rounded-full px-8 py-4 tag font-bold">
                  Accept the Draft
                </Link>
                <Link
                  href="/artists"
                  className="rounded-full border border-white/40 px-8 py-4 tag text-white transition hover:border-volt"
                >
                  See Who&apos;s Signed
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
