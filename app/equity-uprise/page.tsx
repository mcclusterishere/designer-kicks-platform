import Link from "next/link";

export const metadata = {
  title: "Equity Uprise — Private Member Association | The Heat Chart",
  description:
    "The Heat Chart operates as a program of Equity Uprise, a private member association. Read the membership agreement every account holder accepts.",
};

/**
 * The Equity Uprise PMA membership agreement, on-site and readable.
 * Every account holder accepts this — at signup (checkbox) or via the
 * gate for OAuth/legacy accounts. The association's formation papers
 * live off-site with the founder; this page is the member-facing
 * agreement itself.
 */

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. The Association",
    body: [
      "Equity Uprise (“the Association”) is a private member association organized under the founder's rights of free association, contract, and assembly. The Heat Chart — the platform, its battles, leagues, market boards, feeds, and programs — is operated as a private activity of the Association for its members.",
      "The Association exists to advance, document, and reward creative work in sneaker and streetwear culture — with a mission of building equity, ownership, and economic opportunity for the artists and communities that create that culture.",
    ],
  },
  {
    title: "2. Membership",
    body: [
      "Creating an account on The Heat Chart is an application for private membership in the Association. Membership is granted when you accept this agreement, and your acceptance date is recorded on your account.",
      "Membership is personal to you, free at the basic tier, and open to anyone 13 years or older who accepts this agreement. It is not a security, share, or investment, and it confers no ownership stake in the Association or McCluster Corp.",
    ],
  },
  {
    title: "3. Private Domain",
    body: [
      "Activity inside the platform — uploads, battles, votes, rankings, market records, messages, and member-to-member dealings — takes place in the Association's private domain, member to member, and is intended to be governed by this agreement first.",
      "Members deal with each other directly and in good faith. Sales and trades recorded on the platform are private transactions between members; the Association records them but is not a party to them.",
    ],
  },
  {
    title: "4. Member Conduct",
    body: [
      "Members agree to: present only their own creative work (or work they are authorized to present, with collaborators credited); report sales and pricing honestly; respect other members and the cultures this community draws from; and follow the platform's posted rules, which form part of this agreement.",
      "The Association may suspend or end a membership that harms the community — fraud, stolen work, harassment, vote manipulation, or conduct that puts the Association or its members at risk.",
    ],
  },
  {
    title: "5. Disputes",
    body: [
      "Members agree to bring disputes arising inside the Association first to the Association itself for good-faith resolution before any outside action. Nothing in this section limits rights that cannot be waived by agreement.",
    ],
  },
  {
    title: "6. Privacy & Data",
    body: [
      "Member records are Association records. The platform's privacy practices are described in the Privacy Policy, which forms part of this agreement. Seller contact details collected at onboarding stay with the administration and are never published.",
    ],
  },
  {
    title: "7. Leaving",
    body: [
      "You may end your membership at any time by closing your account. Ending membership does not undo transactions already completed or remove your name from battle and sale records that other members rely on.",
    ],
  },
  {
    title: "8. The Fine Print",
    body: [
      "This agreement, the Rules, the Terms, and the Privacy Policy together are the whole deal between you and the Association for use of the platform. If a part of it is found unenforceable, the rest stands. The Association may update this agreement; continued use after notice of a change is acceptance of it.",
    ],
  },
];

export default function EquityUprisePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="tag text-volt">Private Member Association</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">Equity Uprise</h1>
      <p className="mt-4 text-lg leading-relaxed text-smoke">
        The Heat Chart runs as a program of{" "}
        <span className="text-white">Equity Uprise</span>, a private member
        association founded by McCluster Corp. Every account holder is a
        private member. This page is the membership agreement you accept when
        you join.
      </p>

      {/* Plain-language summary before the articles */}
      <div className="mt-8 rounded-xl border border-volt/40 bg-volt/5 p-5">
        <p className="tag text-volt">The short version</p>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-smoke">
          <li>• Your account = private membership. Free, personal, 13+.</li>
          <li>• What happens on the chart stays member-to-member: battles, votes, sales, and rankings are private association activity.</li>
          <li>• Show your own work, price it honestly, credit your collaborators, respect the culture.</li>
          <li>• Problems get worked out inside the house first.</li>
          <li>• Leave whenever you want — your account, your call.</li>
        </ul>
      </div>

      <div className="mt-10 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="display text-2xl text-white">{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-3 text-sm leading-relaxed text-smoke">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-edge bg-surface p-5 text-sm text-smoke">
        <p>
          Related reading:{" "}
          <Link href="/rules" className="text-volt underline">The Rules</Link>
          {" · "}
          <Link href="/terms" className="text-volt underline">Terms</Link>
          {" · "}
          <Link href="/privacy" className="text-volt underline">Privacy</Link>
        </p>
        <p className="mt-2 text-xs text-smoke/70">
          Questions about the Association? Reach the administration through
          the contact channels on the platform. Effective July 2026.
        </p>
      </div>
    </div>
  );
}
