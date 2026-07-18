import Link from "next/link";

export const metadata = {
  title: "Our Story — The Heat Chart",
  description:
    "From a dormant Facebook page to the chart the customs culture keeps score on. Why The Heat Chart exists and what it stands for.",
};

export default function StoryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="tag text-volt">Our story</p>
      <h1 className="display mt-3 text-5xl text-white sm:text-6xl">
        From a page<br />
        to the chart.
      </h1>

      <div className="mt-10 space-y-10 text-lg leading-relaxed text-smoke">
        <section>
          <h2 className="display text-2xl text-white">The page era</h2>
          <p className="mt-3">
            Before this was a platform, it was a Facebook page called{" "}
            <span className="text-white">Designer Kicks</span> — thousands of
            people a day pulling up to look at customized sneakers, argue in
            the comments about which one was harder, and tag the friend who
            needed to see it. The talent was always there. The argument was
            always there. What never existed was a scoreboard.
          </p>
        </section>

        <section>
          <h2 className="display text-2xl text-white">The relaunch</h2>
          <p className="mt-3">
            The Heat Chart is that scoreboard. Artists submit one-of-one work —
            sneakers, apparel, accessories. The culture votes in head-to-head
            battles. Winners climb the Heat List, champions keep their
            trophies forever, and every real sale gets recorded with
            provenance, so a piece&apos;s history travels with it. The argument
            finally has a referee, and it&apos;s you.
          </p>
        </section>

        <section>
          <h2 className="display text-2xl text-white">What we stand on</h2>
          <ul className="mt-4 space-y-4">
            <li className="rounded-xl border border-edge bg-surface p-5">
              <p className="display text-lg text-volt">Artists get the shine — and the money.</p>
              <p className="mt-1 text-base">
                When checkout opens, the seller fee here is 1%. Not 10, not 13.
                The person who made the thing keeps the money the thing made.
              </p>
            </li>
            <li className="rounded-xl border border-edge bg-surface p-5">
              <p className="display text-lg text-volt">Provenance is respect.</p>
              <p className="mt-1 text-base">
                A one-of-one deserves a paper trail. Every sale on the chart is
                claimed by its buyer and carried in the piece&apos;s history —
                who made it, who owned it, what it sold for.
              </p>
            </li>
            <li className="rounded-xl border border-edge bg-surface p-5">
              <p className="display text-lg text-volt">The culture keeps the score.</p>
              <p className="mt-1 text-base">
                No editors picking favorites behind a curtain. Rankings come
                from battles, and battles are decided by votes. One account,
                one vote, receipts public.
              </p>
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-volt/40 bg-surface p-6 text-center">
          <p className="display text-2xl text-white">Pull up.</p>
          <p className="mx-auto mt-2 max-w-md text-base">
            Fans vote free, play free, and collect. Artists get a league page,
            a closet, and a market. The chart is young — the names on it now
            are the ones people will say were here first.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="btn-hard rounded-lg px-6 py-3 tag font-bold">
              Create an Account
            </Link>
            <Link href="/submit" className="btn-hard-volt rounded-lg px-6 py-3 tag font-bold">
              Apply as an Artist
            </Link>
          </div>
        </section>

        <p className="tag border-t border-edge pt-6 text-smoke">
          — Matt · Founder, The Heat Chart · formerly Designer Kicks
        </p>
      </div>
    </div>
  );
}
