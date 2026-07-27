import Link from "next/link";

export const metadata = {
  title: "Terms of Service — The Heat Chart",
  description: "The terms that govern using The Heat Chart.",
};

const EFFECTIVE = "July 17, 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="tag text-volt">Legal</p>
      <h1 className="display mt-2 text-4xl text-white">Terms of Service</h1>
      <p className="mt-1 text-sm text-smoke">Effective {EFFECTIVE}</p>

      <div className="prose-invert mt-8 space-y-6 text-sm leading-6 text-smoke">
        <section>
          <h2 className="display text-xl text-white">1. Who we are</h2>
          <p className="mt-2">
            The Heat Chart (&quot;we&quot;, &quot;the site&quot;) is a community platform for
            custom sneakers and apparel: artist profiles, community vote
            battles, rankings, a trivia game with promotional giveaways, a
            drop-news calendar, and a pricing index for one-of-one customs.
            By creating an account or using the site you agree to these terms.
          </p>
        </section>
        <section>
          <h2 className="display text-xl text-white">2. Accounts</h2>
          <p className="mt-2">
            You must be at least 13 to use the site and at least 18 to enter
            giveaways or record sales. Keep your login private; you&apos;re
            responsible for activity on your account. We can suspend accounts
            that abuse the platform (vote manipulation, fake sales, spam,
            harassment, or attempts to game rankings).
          </p>
        </section>
        <section>
          <h2 className="display text-xl text-white">3. Your content</h2>
          <p className="mt-2">
            You keep ownership of photos and text you upload. You give us a
            non-exclusive license to display them on the site and in our
            social media promotion of the platform. Only upload work you made
            or have permission to post. We may remove content that infringes
            others&apos; rights or breaks these terms.
          </p>
          <p className="mt-2">
            We have zero tolerance for objectionable content or abusive
            behavior. Every post and comment carries a report control, and
            you can block any member to remove their content from your
            feed. Reported content is reviewed and acted on within 24
            hours; accounts that post objectionable material are ejected.
            You can permanently delete your account at any time from your
            profile page.
          </p>
        </section>
        <section>
          <h2 className="display text-xl text-white">4. The market is an index, not a store</h2>
          <p className="mt-2">
            Sales recorded on The Heat Chart happen directly between buyer and
            seller, off-platform. We process no payments, hold no funds, ship
            nothing, and are not a party to any transaction. Recorded prices
            are seller-reported; the &quot;verified&quot; badge means evidence was
            provided or an admin reviewed the sale — it is not a guarantee.
            Offers are non-binding signals of interest. Do your own diligence
            before sending anyone money.
          </p>
        </section>
        <section>
          <h2 className="display text-xl text-white">5. Custom work and brands</h2>
          <p className="mt-2">
            Customs featured here are independent artist work. The Heat Chart
            is not affiliated with, sponsored by, or endorsed by Nike, Jordan
            Brand, adidas, or any footwear or apparel brand. Brand names
            appear only to identify the base item an artist modified.
          </p>
        </section>
        <section>
          <h2 className="display text-xl text-white">6. Giveaways and the quiz</h2>
          <p className="mt-2">
            Giveaways are governed by the{" "}
            <Link href="/rules" className="text-volt underline">Official Rules</Link>.
            No purchase is necessary and purchases never affect odds. Quiz
            credit packs (when on sale) buy extra trivia strikes for
            leaderboard play only and are non-refundable once used.
          </p>
        </section>
        <section>
          <h2 className="display text-xl text-white">7. Affiliate links</h2>
          <p className="mt-2">
            Some outbound links are affiliate links; we may earn a commission
            at no extra cost to you. Raffle and retailer links go to
            third-party sites we don&apos;t control.
          </p>
        </section>
        <section>
          <h2 className="display text-xl text-white">8. Disclaimers</h2>
          <p className="mt-2">
            The site is provided &quot;as is.&quot; To the fullest extent allowed by
            law, we disclaim warranties and are not liable for indirect or
            consequential damages, or for disputes between buyers and sellers.
            Our total liability for any claim is capped at $100.
          </p>
        </section>
        <section>
          <h2 className="display text-xl text-white">9. Changes</h2>
          <p className="mt-2">
            We may update these terms; material changes will be announced on
            the site. Continuing to use the site after changes take effect
            means you accept them. Questions:{" "}
            <span className="text-white">hello@theheatchart.com</span>.
          </p>
        </section>
        <p className="border-t border-edge pt-4 text-xs">
          Draft terms pending attorney review — posted so members know the
          house rules from day one.
        </p>
      </div>
    </div>
  );
}
