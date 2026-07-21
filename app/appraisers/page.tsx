import Link from "next/link";
import AppraiserApplyForm from "@/components/AppraiserApplyForm";

export const metadata = {
  title: "Independent Appraiser Network — The Heat Chart",
  description:
    "USPAP-credentialed personal-property appraisers: the first structured dataset for custom sneakers is looking for its appraisers. Independent by design — our data, your signature.",
};

/**
 * The independent appraiser network — the arm's-length half of the
 * art-capital program. The page sells both directions at once:
 * appraisers get an unclaimed specialty plus the only dataset in it;
 * members and lenders get the independence that makes appraisal paper
 * bankable. The platform's own conflicts are stated in plain sight,
 * because that disclosure is exactly why the network exists.
 */

const APPRAISER_PITCH = [
  {
    title: "An unclaimed specialty",
    body: "There is no established appraisal practice for one-of-one custom sneakers and wearable art. The market exists — verified sales, collectors, lending interest — but the credentialed specialist doesn't. First appraisers in own the niche.",
  },
  {
    title: "The only dataset",
    body: "Every engagement starts from a Portfolio Statement: catalogued works, full provenance chains, verified sales with evidence, disclosed consignments, live bid books, and our published estimate methodology — machine-readable through the public API. You bring USPAP; we bring comps nobody else has.",
  },
  {
    title: "Clients routed to you",
    body: "Artists and collectors pursuing loans, insurance scheduling, estates, or donations get referred out of the platform to network appraisers. You set your own fees and terms; we never touch your conclusions.",
  },
];

const INDEPENDENCE = [
  "Network appraisers are independent professionals — never platform employees, never paid contingent on values.",
  "The platform operates the marketplace and earns fees on it. That interest is disclosed to you and belongs in your report's disclosure section.",
  "Lending appraisals are routed to the network exclusively. The house never signs valuation paper supporting its own or its members' financing.",
  "Your conclusions are yours. We supply records and market data; we never see a draft before the client does.",
];

export default function AppraisersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="tag text-volt">Art Capital · Independent Network</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        The appraiser network
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-smoke">
        Custom sneakers became an asset class before anyone showed up to
        appraise them. The Heat Chart runs the provenance ledger and the
        market data — what the program needs now is{" "}
        <span className="text-white">independent, USPAP-credentialed
        signatures</span> that lenders, insurers, and the IRS will accept.
        That independence is the whole point: it can&apos;t come from us,
        so it comes from you.
      </p>

      <h2 className="display mt-10 text-2xl text-white">For appraisers</h2>
      <div className="mt-4 space-y-4">
        {APPRAISER_PITCH.map((p) => (
          <div key={p.title} className="rounded-xl border border-edge bg-surface p-5">
            <h3 className="display text-lg text-white">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-smoke">{p.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-smoke">
        Looking for: current USPAP (15-hour course + updates) and a
        designation — or active progress toward one — with ISA, AAA, or ASA
        in personal property. Sneaker-culture fluency is a plus we can
        supplement; appraisal discipline we cannot.
      </p>

      {/* The conflicts, in plain sight — this section IS the sales pitch
          to lenders reading over an appraiser's shoulder. */}
      <div className="mt-10 rounded-xl border border-volt/40 bg-volt/5 p-6">
        <h2 className="display text-2xl text-volt">Independence, in writing</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-smoke">
          {INDEPENDENCE.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-volt">■</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <h2 className="display mt-10 text-2xl text-white">For members &amp; institutions</h2>
      <p className="mt-3 text-sm leading-relaxed text-smoke">
        Need a formal appraisal — for a loan, insurance schedule, estate, or
        donation? Start with your{" "}
        <Link href="/studio/portfolio" className="text-volt underline">
          Portfolio Statement
        </Link>
        , then ask the administration for a network introduction. Lenders and
        insurers evaluating the program: the underlying ledger is
        machine-readable through the{" "}
        <Link href="/developers" className="text-volt underline">public API</Link>,
        and the program&apos;s full framework lives at{" "}
        <Link href="/art-capital" className="text-volt underline">/art-capital</Link>.
      </p>

      <h2 className="display mt-10 text-2xl text-white">Join the network</h2>
      <div className="mt-4 rounded-xl border border-edge bg-surface p-6">
        <AppraiserApplyForm />
      </div>

      <p className="mt-8 text-xs leading-relaxed text-smoke/70">
        The Heat Chart is not an appraisal firm and does not direct, review,
        or guarantee network appraisers&apos; conclusions. HC Value Estimates
        remain informational market data, not appraisals.
      </p>
    </div>
  );
}
