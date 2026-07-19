import Link from "next/link";
import { SELL_PLATFORMS, referralUrl } from "@/lib/sellPlatforms";
import Advisor from "./Advisor";

export const metadata = {
  title: "Selling Hub — Sell Your Custom Sneakers | The Heat Chart",
  description:
    "New to selling customs? Start here. The best platforms for custom sneakers, how to price your work, and a free AI advisor built for sneaker artists.",
};
export const dynamic = "force-dynamic";

// The platforms worth guiding a new seller to first (skip the catch-alls).
const GUIDE_KEYS = ["ebay", "shopify", "etsy", "depop", "grailed", "instagram"];

export default function SellPage() {
  const guides = GUIDE_KEYS.map((k) => SELL_PLATFORMS.find((p) => p.key === k)!).filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="tag text-volt">Selling Hub</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">Get paid for your customs</h1>
      <p className="mt-3 text-smoke">
        You made the heat — now sell it. Here&apos;s where custom-sneaker artists
        actually move product, how to think about each, and an AI advisor to
        talk it through. Already selling somewhere?{" "}
        <Link href="/studio" className="text-volt underline">Add your shops in the Studio</Link>{" "}
        so buyers can find them on your page.
      </p>

      {/* The advisor first — it's the interactive hook */}
      <div className="mt-8">
        <Advisor />
      </div>

      {/* Platform guides with our referral links */}
      <h2 className="display mt-12 text-2xl text-white">Where to sell</h2>
      <div className="mt-4 space-y-3">
        {guides.map((p) => (
          <div key={p.key} className="rounded-xl border border-edge bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="display text-xl text-white">{p.label}</h3>
              <a
                href={referralUrl(p)}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="tag rounded-full border border-volt/50 px-4 py-2 text-volt transition hover:border-volt hover:bg-volt/10"
              >
                Start on {p.label} ↗
              </a>
            </div>
            <p className="mt-2 text-sm text-smoke">{p.blurb}</p>
          </div>
        ))}
      </div>

      {/* Quick pricing primer — evergreen, no external calls */}
      <h2 className="display mt-12 text-2xl text-white">Pricing your work (fast primer)</h2>
      <div className="mt-4 space-y-2 rounded-xl border border-edge bg-surface p-5 text-sm text-smoke">
        <p><span className="text-white">Cover your costs first.</span> Donor pair + paints + hours × your rate. That&apos;s your floor, never your price.</p>
        <p><span className="text-white">Charge for the one-of-one.</span> A custom isn&apos;t a retail pair — it&apos;s art. Comparable customs, not the base shoe, set the market.</p>
        <p><span className="text-white">Let the chart do the talking.</span> A high Heat Score and battle wins are proof — screenshot them in your listings.</p>
        <p><span className="text-white">Start a touch high.</span> You can always run a drop or take offers; it&apos;s hard to raise a number you anchored low.</p>
      </div>

      <div className="mt-8 rounded-2xl border border-volt/40 bg-surface p-5 text-center">
        <p className="text-white">Rather have a human walk you through it?</p>
        <p className="mt-1 text-sm text-smoke">
          The league office has your back — reach out from your{" "}
          <Link href="/profile" className="text-volt underline">profile</Link>.
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-smoke/60">
        Some links on this page are referral links — they help keep The Heat
        Chart free, at no cost to you.
      </p>
    </div>
  );
}
