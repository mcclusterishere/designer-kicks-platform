import Link from "next/link";

export const metadata = {
  title: "Security — The Heat Chart",
  description:
    "How The Heat Chart handles accounts, payments, uploads and your data — what we do, what we don't, and what we're not claiming.",
};

/**
 * The security page.
 *
 * Written to answer what people actually ask before trusting a platform
 * with a customer list, and deliberately not written as a compliance
 * brochure. It says plainly that we hold no SOC 2 report and no ISO
 * 27001 certificate, because claiming or implying otherwise is both a
 * lie and, if it ever influenced a purchase, a deceptive practice.
 *
 * Everything listed under "what we do" is a control that exists in the
 * codebase today. Nothing aspirational is in that section — the things
 * we haven't built yet are named in their own section instead.
 */

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-edge py-4">
      <h3 className="font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-smoke">{children}</p>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="tag text-volt">Security</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        How we handle your stuff
      </h1>
      <p className="mt-4 text-lg text-smoke">
        You&apos;re being asked to keep your work, your sales history and eventually your customer
        list here. That deserves a straight account of how it&apos;s held — including the parts we
        haven&apos;t built yet.
      </p>

      <section className="mt-10">
        <h2 className="display text-2xl text-white">What we do</h2>

        <Item title="Passwords are hashed, never stored">
          Passwords go through bcrypt and are never written down in a readable form. Nobody here
          can look up your password, including us. Sign in with Google or Facebook instead and we
          never receive one at all.
        </Item>

        <Item title="We never see your card">
          Payments run entirely through Stripe. Card numbers never touch our servers or our
          database — Stripe handles the card data and the PCI obligations that come with it. We
          store an anonymous customer reference and what plan you&apos;re on, nothing more.
        </Item>

        <Item title="The admin console is password-gated, with 2FA available">
          The control room sits behind its own password, separate from any member account, and
          supports a time-based one-time code from an authenticator app on top of it. We say
          &ldquo;available&rdquo; rather than &ldquo;required&rdquo; deliberately — it is a switch
          the operator turns on, and claiming otherwise on a page like this would be exactly the
          kind of thing this page exists not to do.
        </Item>

        <Item title="Your customer list is yours alone">
          Contacts are scoped to a single artist. Two makers who both know the same collector each
          keep a separate record with their own notes and their own history — no artist can see
          another&apos;s book. You can export the whole thing as CSV whenever you like. Software
          that holds your customer list hostage isn&apos;t a tool.
        </Item>

        <Item title="An automated sweep looks for leaked secrets">
          A test fetches the real public pages on every change and greps the bytes we actually
          send for things that must never appear — password hashes, buyer email addresses,
          consignor names, session tokens, API keys, and our own inventory cost basis. It exists
          because a public page once served an artist&apos;s password hash in its HTML: the query
          fetched it, a component was handed the whole object, and React serialised it. Nothing
          failed and nothing warned. A comment can&apos;t enforce that, so a test does.
        </Item>

        <Item title="Uploads are re-encoded, not just accepted">
          Every uploaded image is decoded and re-encoded to a clean JPEG rather than being stored
          and served as-is. Size and type are checked before anything is written.
        </Item>

        <Item title="Dependencies are audited on every push">
          Continuous integration blocks a build carrying a high or critical vulnerability in a
          production dependency, and re-runs weekly so a CVE published after a green build gets
          caught. This is here because six of them once accumulated unnoticed — two critical, both
          in the authentication stack — and were found by accident rather than by a control.
        </Item>

        <Item title="Rate limits, and the right kind">
          Sign-in attempts are limited, and failures count against you — that&apos;s the point.
          Actions like posting a piece are limited on success only, so a failed upload never eats
          your budget and locks you out of a site you were trying to use.
        </Item>

        <Item title="Sensible transport and browser headers">
          HTTPS is enforced with HSTS. Framing, MIME sniffing and referrer leakage are all
          restricted, and unused browser features are switched off.
        </Item>

        <Item title="You can delete your account">
          Permanently, yourself, from your profile page. No email, no waiting on a human.
        </Item>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl text-white">What we are not claiming</h2>
        <p className="mt-3 text-sm leading-relaxed text-smoke">
          The Heat Chart does <span className="font-bold text-white">not</span> hold a SOC 2
          report and is <span className="font-bold text-white">not</span> ISO/IEC 27001 certified.
          We are a small team and we have not been through either process. If you need a vendor
          with one of those, we are not that vendor yet — and any platform our size telling you
          otherwise is worth a second look.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-smoke">
          We also haven&apos;t had an independent penetration test. The security work described
          above is real and is in the code, but it has been reviewed by us, not by a third party.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl text-white">Where your data actually lives</h2>
        <Item title="Hosting">
          The application and its PostgreSQL database run on Railway. Uploaded images are stored
          alongside the application data rather than on a third-party image host.
        </Item>
        <Item title="Who we hand data to">
          Stripe for payments. Email delivery for password resets and notifications. Analytics
          that measures pages, not people. Signing in with Google or Facebook shares your basic
          profile with us — not the other way round. The{" "}
          <Link href="/privacy" className="text-volt underline">
            privacy policy
          </Link>{" "}
          is the full list.
        </Item>
        <Item title="Marketing email">
          Contacts you import are never marked as having opted in, whatever the file says.
          Somebody&apos;s phone book is not a mailing list, and treating it as one is a legal
          problem for you and a deliverability problem for every other artist here.
        </Item>
      </section>

      <section className="mt-10 rounded-xl border border-volt/40 bg-surface p-5">
        <h2 className="display text-xl text-white">Found something?</h2>
        <p className="mt-2 text-sm leading-relaxed text-smoke">
          Tell us before you tell anyone else and we&apos;ll fix it. Email{" "}
          <span className="font-bold text-white">security@theheatchart.com</span> with enough
          detail to reproduce it. We&apos;ll confirm we got it, keep you posted while we work, and
          credit you when it&apos;s fixed if you want the credit.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-smoke">
          We won&apos;t pursue anyone who reports a genuine issue in good faith, sticks to their
          own account and test data, and doesn&apos;t degrade the service for anybody else. No
          bounty programme — we&apos;re not big enough yet — but we will say thank you properly.
        </p>
      </section>

      <p className="mt-8 text-xs text-smoke">
        This page describes what is true today and will change as the platform does. It is a
        description of our practices, not a contract or a warranty — the{" "}
        <Link href="/terms" className="underline hover:text-white">
          Terms
        </Link>{" "}
        govern that.
      </p>
    </div>
  );
}
