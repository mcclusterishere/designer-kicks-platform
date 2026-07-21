import Link from "next/link";
import { DK_VARIANTS } from "./variants";

export const metadata = {
  title: "DK × Heat Chart — Campaign HQ",
  description:
    "Every ad creative, its landing page, and its copy-paste Facebook copy in one place.",
  robots: { index: false, follow: false },
};

/**
 * The campaign control page for the Designer Kicks rebrand buy: every
 * creative, its landing page, its exact ad URL (utm-tagged per variant
 * so results read per-creative), and the copy to paste into Ads
 * Manager. Not linked from anywhere public and noindexed — this page
 * exists so the ad buy is a copy-paste job, not a memory test.
 */

const SITE = "https://theheatchart.com";
const UTM = "utm_source=facebook&utm_medium=paid&utm_campaign=dk_rebrand";

export default function DkCampaignPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="tag text-heat">Campaign HQ · Designer Kicks Rebrand</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Six creatives. One <span className="text-gradient-volt">$20 shot.</span>
      </h1>
      <p className="mt-3 max-w-2xl text-smoke">
        Each creative has its own landing page and its own utm-tagged URL, so
        every click and signup reads per-creative. Paste the copy below
        straight into Ads Manager.
      </p>

      {/* The buy, step by step */}
      <div className="mt-8 rounded-2xl border border-volt/40 bg-volt/5 p-5">
        <h2 className="display text-xl text-white">The $20 buy — one pass</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-smoke">
          <li>
            Download the six videos below (open link → ⋮ → download), then in
            Meta <span className="text-white">Ads Manager</span>: one campaign,
            objective <span className="text-white">Traffic</span>.
          </li>
          <li>
            One ad set: budget <span className="text-white">$20, run 1 day</span>.
            Audience: <span className="text-white">People who like the Designer
            Kicks Page</span> (+ engaged in last 365 days). Placements: manual —
            Facebook Feed + Reels only (the creatives are 9:16).
          </li>
          <li>
            Six ads in that ad set — one video each, with its landing URL below.
            Meta shifts spend to whichever creative wins: that IS the A/B test.
          </li>
          <li>
            Reading results: Ads Manager shows clicks per ad; signups per
            creative show in the site analytics by landing path (/dk/…) and
            registration ref.
          </li>
        </ol>
      </div>

      {/* The creatives */}
      <div className="mt-10 space-y-6">
        {DK_VARIANTS.map((v, i) => {
          const adUrl = `${SITE}/dk/${v.slug}?${UTM}&utm_content=${v.slug}`;
          return (
            <div key={v.slug} className="rounded-2xl border border-edge bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="display text-2xl text-white">
                  <span className="text-smoke/60">{i + 1}.</span> {v.name}{" "}
                  <span className="tag text-smoke">· {v.duration}</span>
                </h2>
                <Link href={`/dk/${v.slug}`} className="tag text-volt underline underline-offset-4">
                  Preview landing page →
                </Link>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
                <video
                  src={v.video}
                  poster={v.poster ?? undefined}
                  muted
                  loop
                  playsInline
                  controls
                  preload="none"
                  className="aspect-[9/16] w-full rounded-xl border border-edge bg-black object-cover"
                />
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="tag text-smoke">Primary text</p>
                    <p className="mt-1 rounded-lg border border-edge bg-ink/40 p-3 text-white">
                      {v.fb.primaryText}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="tag text-smoke">Headline</p>
                      <p className="mt-1 rounded-lg border border-edge bg-ink/40 p-3 text-white">
                        {v.fb.headline}
                      </p>
                    </div>
                    <div>
                      <p className="tag text-smoke">Description</p>
                      <p className="mt-1 rounded-lg border border-edge bg-ink/40 p-3 text-white">
                        {v.fb.description}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="tag text-smoke">Ad destination URL</p>
                    <p className="mt-1 break-all rounded-lg border border-edge bg-ink/40 p-3 font-mono text-xs text-volt">
                      {adUrl}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <a href={v.video} target="_blank" rel="noopener noreferrer" className="tag text-volt underline underline-offset-4">
                      Open video file →
                    </a>
                    <span className="tag text-smoke">CTA button: Sign Up</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* The announcement post — free, pin it before the paid buy */}
      <div className="mt-10 rounded-2xl border border-edge bg-surface p-5">
        <h2 className="display text-xl text-white">
          Pin this first — the free rebrand post
        </h2>
        <p className="mt-2 text-sm text-smoke">
          Post organically on the Designer Kicks page before the ads run, so
          paid clicks that check the page see the announcement:
        </p>
        <blockquote className="mt-3 rounded-lg border border-edge bg-ink/40 p-4 text-sm leading-relaxed text-white">
          Designer Kicks has a new home. 🔥
          <br />
          We built THE HEAT CHART — the stock market for custom sneakers.
          Artists battle. You vote. One-of-one pieces get ranked, priced, and
          collected like assets.
          <br />
          Fans: vote + bid on 1-of-1s. Customizers: get drafted, earn on every
          resale. Collectors: verified customs with real market data.
          <br />
          Free account → theheatchart.com
        </blockquote>
      </div>
    </div>
  );
}
