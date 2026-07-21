import Link from "next/link";
import { DK_VARIANTS } from "./variants";

export const metadata = {
  title: "DK × Heat Chart — Asset Landing Pages",
  description:
    "Every generated asset, its own landing page, and its copy in one place.",
  robots: { index: false, follow: false },
};

/**
 * The index for the Designer Kicks rebrand assets: every generated
 * video has its own landing page with its copy, and this page is the
 * one place to see them all — preview link, the asset itself, the
 * copy that pairs with it, and the tagged URL to use anywhere the
 * asset runs. Not linked from anywhere public and noindexed.
 */

const SITE = "https://theheatchart.com";
const UTM = "utm_source=facebook&utm_medium=paid&utm_campaign=dk_rebrand";

export default function DkCampaignPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="tag text-heat">Designer Kicks × The Heat Chart</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Every asset. Its own <span className="text-gradient-volt">landing page.</span>
      </h1>
      <p className="mt-3 max-w-2xl text-smoke">
        Each video generated for the rebrand has its own landing page with the
        asset embedded and copy built around it. Preview each one below; the
        tagged URL under it is the one to run anywhere the asset posts, so
        clicks and signups read per-asset.
      </p>

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
                    <p className="tag text-smoke">Landing page URL (tagged)</p>
                    <p className="mt-1 break-all rounded-lg border border-edge bg-ink/40 p-3 font-mono text-xs text-volt">
                      {adUrl}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <a href={v.video} target="_blank" rel="noopener noreferrer" className="tag text-volt underline underline-offset-4">
                      Open video file →
                    </a>
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
          The rebrand post — pin it on the Designer Kicks page
        </h2>
        <p className="mt-2 text-sm text-smoke">
          The announcement copy, ready to post, so anyone who checks the page
          sees where it all went:
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
