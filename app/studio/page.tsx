import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getStudioData } from "@/lib/analytics";
import { getHeatList } from "@/lib/battles";
import { formatUsd } from "@/lib/market";

import MiniBars from "@/components/MiniBars";
import AnnounceDropForm from "./AnnounceDropForm";
import AddShopForm from "./AddShopForm";
import { removeArtistShop, markSellsNowhere } from "@/app/actions";
import { platformLabel } from "@/lib/sellPlatforms";

export const metadata = { title: "Artist Studio — The Heat Chart" };
export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const profile = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true, sellsOnline: true },
  });
  if (!profile || profile.status !== "APPROVED") redirect("/submit");

  const [data, heat, myDrops, myShops] = await Promise.all([
    getStudioData(profile.id),
    getHeatList(),
    prisma.artistDrop.findMany({ where: { artistId: profile.id }, orderBy: { dropAt: "asc" } }),
    prisma.artistShop.findMany({ where: { artistId: profile.id }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!data) redirect("/submit");
  const heatRank = new Map(heat.map((h, i) => [h.id, i + 1]));
  const { artist, stats, votesSeries, followsLast14, soldSales } = data;

  const bestRank = Math.min(
    ...artist.submissions.map((s) => heatRank.get(s.id) ?? Infinity)
  );

  const tiles = [
    { label: "Total votes", value: stats.totalVotes },
    { label: "Record", value: `${stats.wins}W–${stats.losses}L` },
    { label: "Win rate", value: stats.winRate === null ? "—" : `${stats.winRate}%` },
    { label: "Followers", value: stats.followers },
    { label: "Profile views", value: stats.views },
    { label: "Best heat rank", value: Number.isFinite(bestRank) ? `#${bestRank}` : "—" },
    {
      label: "Rate-game score",
      value: stats.avgRating !== null ? `${stats.avgRating} / 5 (${stats.ratingsCount})` : "—",
    },
    { label: "Revenue (verified-track)", value: formatUsd(stats.revenueCents) },
    {
      label: "Open offers",
      value: stats.openOffers > 0
        ? `${stats.openOffers} · top ${formatUsd(stats.topOfferCents)}`
        : "0",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="tag text-volt">Artist Studio</p>
          <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
            {artist.displayName}
          </h1>
          <p className="mt-1 text-sm text-smoke">
            Plan: <span className="text-volt">{artist.plan === "PRO" ? "Pro" : "Free — founding artist"}</span>
          </p>
        </div>
        <Link
          href={`/artists/${artist.slug}`}
          className="tag rounded-full border border-edge px-4 py-2 text-smoke transition hover:border-volt hover:text-white"
        >
          Public page →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-edge bg-surface p-4 text-center">
            <p className="display text-xl text-volt sm:text-2xl">{t.value}</p>
            <p className="tag mt-1 text-smoke">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Momentum */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-edge bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="display text-lg text-white">Votes — last 14 days</h2>
            <span className="tag text-smoke">
              {votesSeries.reduce((s, d) => s + d.count, 0)} total
            </span>
          </div>
          <div className="mt-4">
            <MiniBars series={votesSeries} />
          </div>
        </div>
        <div className="rounded-xl border border-edge bg-surface p-5">
          <h2 className="display text-lg text-white">Last 14 days</h2>
          <ul className="mt-3 space-y-2 text-sm text-smoke">
            <li>
              <span className="text-white">{followsLast14}</span> new follower
              {followsLast14 === 1 ? "" : "s"}
            </li>
            <li>
              <span className="text-white">{stats.openOffers}</span> open offer
              {stats.openOffers === 1 ? "" : "s"} waiting on you
              {stats.openOffers > 0 && (
                <>
                  {" — "}
                  <Link href="/profile" className="text-volt underline">
                    respond →
                  </Link>
                </>
              )}
            </li>
            <li>
              Battles put your work in front of voters —{" "}
              <Link href="/battles" className="text-volt underline">
                see the arena
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Per-piece breakdown */}
      <h2 className="display mt-10 text-2xl text-white">
        Your Pieces
      </h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-edge">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-panel">
            <tr className="tag text-smoke">
              <th className="px-4 py-3">Piece</th>
              <th className="px-3 py-3">Votes</th>
              <th className="px-3 py-3">Record</th>
              <th className="px-3 py-3">Heat rank</th>
              <th className="px-3 py-3">Rating</th>
              <th className="px-3 py-3">Last sale</th>
              <th className="px-3 py-3">Ask</th>
              <th className="px-3 py-3">Offers</th>
            </tr>
          </thead>
          <tbody>
            {artist.submissions.map((s) => {
              const battles =
                s.battlesAsA.filter((b) => b.status === "COMPLETED").length +
                s.battlesAsB.filter((b) => b.status === "COMPLETED").length;
              const rank = heatRank.get(s.id);
              const lastSale = s.sales.find((x) => x.status === "CONFIRMED");
              const pending = s.sales.some((x) => x.status === "PENDING");
              return (
                <tr key={s.id} className="border-t border-edge bg-surface">
                  <td className="px-4 py-3">
                    <span className="font-bold text-white">
                      {s.title}
                    </span>
                    {pending && <span className="tag text-heat"> · sale pending</span>}
                  </td>
                  <td className="px-3 py-3 text-white">{s._count.votes}</td>
                  <td className="px-3 py-3 text-smoke">
                    {s._count.battlesWon}W–{battles - s._count.battlesWon}L
                  </td>
                  <td className="px-3 py-3 text-volt">{rank ? `#${rank}` : "—"}</td>
                  <td className="px-3 py-3 text-smoke">
                    {s.ratings.length > 0
                      ? `${Math.round((s.ratings.reduce((sum, r) => sum + r.stars, 0) / s.ratings.length) * 10) / 10} / 5 (${s.ratings.length})`
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-smoke">
                    {lastSale ? formatUsd(lastSale.priceCents) : "—"}
                  </td>
                  <td className="px-3 py-3 text-smoke">
                    {s.askingPriceCents ? formatUsd(s.askingPriceCents) : "—"}
                  </td>
                  <td className="px-3 py-3 text-smoke">
                    {s.offers.length > 0 ? (
                      <span className="text-volt">
                        {s.offers.length} · top {formatUsd(s.offers[0].amountCents)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sales ledger */}
      {soldSales.length > 0 && (
        <>
          <h2 className="display mt-10 text-2xl text-white">
            Sales Ledger
          </h2>
          <div className="mt-4 space-y-2">
            {soldSales.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
              >
                <span className="text-smoke">
                  {s.soldAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="font-bold text-white">{formatUsd(s.priceCents)}</span>
                {s.verified ? (
                  <span className="tag text-volt">✓ verified</span>
                ) : (
                  <span className="tag text-smoke">unverified</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Announce your own drops onto the public calendar */}
      <div className="mt-12">
        <p className="display text-xl text-white">Announce a drop</p>
        <p className="mt-1 max-w-2xl text-sm text-smoke">
          Got a release coming? Put it on the public drop calendar — it goes
          live once the league office approves it.
        </p>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <AnnounceDropForm />
        </div>
        {myDrops.length > 0 && (
          <div className="mt-5">
            <p className="tag text-smoke">Your announced drops</p>
            <div className="mt-2">
              {myDrops.map((d) => (
                <div key={d.id} className="flex items-center gap-3 border-b border-edge/60 py-2.5">
                  <span className="tag w-16 shrink-0 text-heat">
                    {d.dropAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-white">{d.title}</span>
                  <span
                    className={`tag shrink-0 ${
                      d.status === "APPROVED"
                        ? "text-volt"
                        : d.status === "REJECTED"
                          ? "text-heat"
                          : "text-smoke"
                    }`}
                  >
                    {d.status === "APPROVED" ? "Live" : d.status === "REJECTED" ? "Declined" : "In review"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Where you sell — surfaced on your public page + market */}
      <div className="mt-12">
        <p className="display text-xl text-white">Where you sell</p>
        <p className="mt-1 max-w-2xl text-sm text-smoke">
          Link every shop you already sell through — eBay, Shopify, Etsy, Depop,
          your own site, anywhere. They show up as “Shop their work” buttons on
          your page so voters can buy straight from you.
        </p>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <AddShopForm />
          {myShops.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-edge pt-4">
              {myShops.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="font-bold text-white">{s.label || platformLabel(s.platform)}</span>{" "}
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="truncate text-smoke hover:text-volt">
                      {s.url}
                    </a>
                  </div>
                  <form action={removeArtistShop.bind(null, s.id)}>
                    <button className="tag shrink-0 text-heat underline">remove</button>
                  </form>
                </div>
              ))}
            </div>
          )}
          {myShops.length === 0 && (
            <div className="mt-4 border-t border-edge pt-4">
              <p className="text-sm text-smoke">
                Don&apos;t sell anywhere yet? We&apos;ll help you start —{" "}
                <Link href="/sell" className="text-volt underline">the Selling Hub</Link>{" "}
                has guides, the best platforms, and an AI advisor.
              </p>
              {profile.sellsOnline !== false && (
                <form action={markSellsNowhere} className="mt-2">
                  <button className="tag text-smoke underline hover:text-white">
                    I don&apos;t sell anywhere yet →
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* The future paid tier, primed honestly */}
      <div className="mt-12 rounded-xl border border-volt/40 bg-surface p-6">
        <p className="display text-xl text-white">
          Heat Chart Pro is coming
        </p>
        <p className="mt-2 max-w-2xl text-sm text-smoke">
          Deeper analytics, produced video ads for your pieces, priority
          battle placement, and storefront tools. Founding artists — everyone
          reading this — keep free access to everything on this page forever.
        </p>
      </div>
    </div>
  );
}
