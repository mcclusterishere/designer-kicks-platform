import Link from "next/link";

export const metadata = {
  title: "Art Capital — Your Customs Are Assets | The Heat Chart",
  description:
    "Custom sneakers are art, and art is an asset class. How The Heat Chart's provenance ledger, HC Value Estimates, and portfolio statements help artists put their work to work — the legitimate way.",
};

/**
 * The program page for art-as-an-asset. Written to be read by three
 * audiences at once: artists (what you get), collectors (why disclosed
 * consignments protect you), and institutions (why this data can be
 * trusted). The integrity section is deliberately blunt — the trust of
 * lenders is the entire value of the program, so the page leads with
 * what we DON'T allow.
 */

const PILLARS = [
  {
    title: "1 · The Provenance Ledger",
    body: "Every piece on the chart carries its history: who made it, who co-signed it, when it sold, for how much, and whether the sale was substantiated with evidence. Consignment relists disclose the prior price and the split on the record. That chain of custody is what separates art with value from art with a price tag.",
  },
  {
    title: "2 · HC Value Estimates",
    body: "Our valuation engine turns the ledger into numbers — a range per piece, with the evidence it stands on listed line by line. Verified open-market sales weigh most; commission fees, bids, and asks weigh progressively less; the Heat Index adds at most a ±10% momentum nudge. The methodology is published, the same for every artist, and machine-readable through our public API.",
  },
  {
    title: "3 · The Portfolio Statement",
    body: "One tap in the Artist Studio produces a lender-ready document: your catalogued works, full provenance chains, verified sales volume, and estimate ranges — with the methodology and its limits printed on the page. It's built to survive a diligence review, because everything on it cites a platform record.",
  },
];

const RULES = [
  "Every sale marked ✓ verified was substantiated with a receipt, payment evidence, or admin review.",
  "Relisting a piece you previously sold requires a disclosed consignment: prior price, consignor split, and bid floor go on the public record.",
  "Related-party sales presented as arm's-length market evidence are grounds for removal from the program — and are how people catch fraud charges. We don't touch it.",
  "HC Value Estimates are market data, not appraisals. Lending, insurance, tax, and donation decisions require a qualified independent appraiser — we're built to hand that appraiser a clean file.",
];

export default function ArtCapitalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="tag text-volt">Equity Uprise · Art Capital</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Your customs are assets.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-smoke">
        A one-of-one custom is art, and art is an asset class — banks lend
        against it, insurers cover it, estates hold it. What separates the
        art that banks touch from everything else isn&apos;t talent.
        It&apos;s <span className="text-white">paper</span>: provenance,
        real sales records, and a valuation somebody credible stands
        behind. The Heat Chart builds that paper for custom culture.
      </p>

      <div className="mt-10 space-y-4">
        {PILLARS.map((p) => (
          <div key={p.title} className="rounded-xl border border-edge bg-surface p-5">
            <h2 className="display text-xl text-white">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-smoke">{p.body}</p>
          </div>
        ))}
      </div>

      {/* Commission vs original — the distinction most artists don't know */}
      <h2 className="display mt-12 text-2xl text-white">
        Commissioned vs. original — why we track the difference
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-edge bg-surface p-5">
          <p className="tag text-volt">Original — open market</p>
          <p className="mt-2 text-sm leading-relaxed text-smoke">
            Made on your own vision, priced by bids and sales. When an
            original sells, the price is <span className="text-white">price
            discovery</span> — real evidence of what the market pays for
            your hand. This is the strongest material in your portfolio.
          </p>
        </div>
        <div className="rounded-xl border border-edge bg-surface p-5">
          <p className="tag text-heat">Commission — made to order</p>
          <p className="mt-2 text-sm leading-relaxed text-smoke">
            Made for a client at an agreed fee. That fee is{" "}
            <span className="text-white">income evidence</span> — it proves
            demand for your labor, but it&apos;s a negotiated contract, not
            an open-market price. Appraisers weigh it differently, so our
            estimates do too. Both belong in your portfolio; they just tell
            different stories.
          </p>
        </div>
      </div>

      {/* The integrity section — deliberately the loudest thing on the page */}
      <div className="mt-12 rounded-xl border border-volt/40 bg-volt/5 p-6">
        <h2 className="display text-2xl text-volt">The integrity rules</h2>
        <p className="mt-2 text-sm leading-relaxed text-smoke">
          This program only works if a lender&apos;s diligence team can
          trust our ledger more than they trust a gallery&apos;s word. So:
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-smoke">
          {RULES.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-volt">■</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* The path */}
      <h2 className="display mt-12 text-2xl text-white">The path for artists</h2>
      <ol className="mt-4 space-y-3 text-sm leading-relaxed text-smoke">
        <li>
          <span className="font-bold text-white">1. Build the record.</span>{" "}
          Upload your work, tag originals vs. commissions, price your asks,
          battle, and record every sale with evidence — verified sales are
          the bricks everything else stands on.
        </li>
        <li>
          <span className="font-bold text-white">2. Bring pieces home.</span>{" "}
          Work you sold early for short money? Arrange it with the collector
          and relist it as a disclosed consignment — they get their split,
          you get the resale on your ledger, and the new price is real
          market evidence because nothing about it is hidden.
        </li>
        <li>
          <span className="font-bold text-white">3. Pull your statement.</span>{" "}
          The{" "}
          <Link href="/studio/portfolio" className="text-volt underline">
            Portfolio Statement
          </Link>{" "}
          in your Studio assembles the whole record, lender-ready.
        </li>
        <li>
          <span className="font-bold text-white">4. Go to the institutions.</span>{" "}
          Take the statement to a qualified appraiser for a formal
          valuation, then to lenders. Art-secured lending is a real,
          established industry — what it demands is exactly the paper this
          platform builds. As partner institutions come aboard, we&apos;ll
          route introductions through the program.
        </li>
      </ol>

      <div className="mt-12 rounded-xl border border-edge bg-surface p-6">
        <p className="tag text-smoke">For institutions</p>
        <p className="mt-2 text-sm leading-relaxed text-smoke">
          Lenders, galleries, appraisers, and insurers: the ledger behind
          this program is machine-readable through our{" "}
          <Link href="/developers" className="text-volt underline">
            public API
          </Link>{" "}
          — pieces, provenance, pricing, and the published estimate
          methodology. To talk partnerships, reach the administration
          through the platform&apos;s contact channels.
        </p>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-smoke/70">
        HC Value Estimates are informational market-data estimates, not
        appraisals, and The Heat Chart is not a lender, appraiser, or
        broker-dealer. Members deal with each other and with institutions
        directly. Read the{" "}
        <Link href="/equity-uprise" className="underline">membership agreement</Link>{" "}
        and <Link href="/terms" className="underline">terms</Link>.
      </p>
    </div>
  );
}
