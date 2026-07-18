import AnalyticsOptOut from "@/components/AnalyticsOptOut";

export const metadata = {
  title: "Privacy Policy — The Heat Chart",
  description: "What The Heat Chart collects, why, and your choices.",
};

const EFFECTIVE = "July 17, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="tag text-volt">Legal</p>
      <h1 className="display mt-2 text-4xl text-white">Privacy Policy</h1>
      <p className="mt-1 text-sm text-smoke">Effective {EFFECTIVE}</p>

      <div className="mt-8 space-y-6 text-sm leading-6 text-smoke">
        <section>
          <h2 className="display text-xl text-white">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <span className="text-white">Account info</span> — name, email,
            password (stored as a salted hash), and any profile details you
            choose to add (city, shoe size, favorite brands, Instagram).
            </li>
            <li>
              <span className="text-white">Activity</span> — votes, quiz runs,
              giveaway entries, submissions, offers, and recorded sales.
            </li>
            <li>
              <span className="text-white">Sign-in via Google/Facebook</span>{" "}
              (when enabled) — your name, email, and avatar from that provider.
              We never see those passwords.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="display text-xl text-white">What we use it for</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Running the platform: battles, rankings, the quiz, giveaways, the market.</li>
            <li>Transactional email: password resets, artist approvals, offer and sale notifications.</li>
            <li>If you opt in: news and promo email about drops and battles.</li>
            <li>Contacting giveaway winners (a legal requirement of running them).</li>
          </ul>
        </section>
        <section>
          <h2 className="display text-xl text-white">What we don&apos;t do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>We don&apos;t sell your personal information.</li>
            <li>We don&apos;t share it with advertisers.</li>
            <li>
              We share data only with the services that run the site (hosting,
              email delivery, payment processing when it launches) and when the
              law requires it.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="display text-xl text-white">Public by design</h2>
          <p className="mt-2">
            Artist pages, collector closets, battle votes counts, leaderboard
            names, and recorded sale prices are public — that&apos;s the product.
            Your email is never shown publicly. A buyer&apos;s email entered by a
            seller is used only to route the claim and notify that buyer.
          </p>
        </section>
        <section>
          <h2 className="display text-xl text-white">Your choices</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Edit or remove profile details anytime from your profile.</li>
            <li>Marketing email is opt-in and every send has an unsubscribe.</li>
            <li>
              Want your account and data deleted? Email{" "}
              <span className="text-white">hello@theheatchart.com</span> from
              your account address and we&apos;ll handle it.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="display text-xl text-white">Cookies</h2>
          <p className="mt-2">
            We use only the cookies needed to keep you signed in. No
            third-party ad trackers, no advertising cookies, no cross-site
            tracking. That&apos;s why you don&apos;t see a cookie banner here —
            there&apos;s nothing to consent to.
          </p>
        </section>
        <section>
          <h2 className="display text-xl text-white">Analytics (cookie-free)</h2>
          <p className="mt-2">
            We measure traffic ourselves, on our own servers, without
            cookies. For each pageview we record: the page URL, the
            referring site (e.g. &quot;facebook&quot;), campaign tags in the
            link, a device class (mobile/desktop), and an anonymous
            visitor code. That code is a one-way hash that changes every
            day, so it can&apos;t follow you over time or across sites. Your
            IP address is used only to compute it and is never stored.
            Traffic records are deleted after 180 days. We honor your
            browser&apos;s Do&nbsp;Not&nbsp;Track setting, and you can switch
            analytics off for this browser right here:
          </p>
          <AnalyticsOptOut />
        </section>
        <p className="border-t border-edge pt-4 text-xs">
          Draft policy pending attorney review. We&apos;ll announce material
          changes on the site.
        </p>
      </div>
    </div>
  );
}
