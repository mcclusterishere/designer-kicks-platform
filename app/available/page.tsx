import Money from "@/components/Money";
import Link from "next/link";
import { getAvailableNow, formatUsd } from "@/lib/market";
import { categoryLabel } from "@/lib/categories";
import { prisma } from "@/lib/db";
import CommissionDesk from "@/components/CommissionDesk";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Available Now — Ready-to-Ship Custom 1-of-1s | The Heat Chart",
  description:
    "Finished one-of-one custom sneakers you can buy today — no commission wait. Real pieces, real prices, one owner each.",
  openGraph: {
    title: "Available Now — Ready-to-Ship Custom 1-of-1s",
    description:
      "Skip the wait. Finished custom sneakers available right now, each a true one-of-one.",
    type: "website",
  },
};

export default async function AvailablePage() {
  const [pieces, openDesks] = await Promise.all([
    getAvailableNow(48),
    prisma.artistProfile.findMany({
      where: { status: "APPROVED", commissionOpen: true, commissionMinCents: { not: null } },
      orderBy: { commissionDays: "asc" },
      take: 6,
      select: {
        slug: true, displayName: true,
        commissionOpen: true, commissionMinCents: true, commissionMaxCents: true,
        commissionDays: true, commissionSlots: true,
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <p className="tag text-volt">No wait · one owner each</p>
      <h1 className="display mt-2 text-5xl text-white sm:text-6xl">AVAILABLE NOW</h1>
      <p className="mt-3 max-w-2xl text-lg text-smoke">
        Finished one-of-ones, already made and ready to ship. Custom work usually means a
        commission and a wait — this is the shelf you can buy off today. When it&apos;s gone,
        it&apos;s gone: every piece here has exactly one owner.
      </p>

      {pieces.length === 0 ? (
        <div className="mt-8 rounded-xl border border-edge bg-surface p-6">
          <p className="text-white">Nothing on the shelf this minute.</p>
          <p className="mt-1 text-sm text-smoke">
            New pieces land as artists list them. In the meantime,{" "}
            <Link href="/artists" className="text-volt underline">commission a maker</Link> or
            browse <Link href="/market" className="text-volt underline">the market</Link>.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-6 tag text-smoke">
            {pieces.length} piece{pieces.length === 1 ? "" : "s"} ready to ship
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pieces.map((p) => (
              <Link
                key={p.id}
                href={`/market?board=customs&sym=${p.id}`}
                className="group overflow-hidden rounded-xl border border-edge bg-surface transition hover:border-volt/50"
              >
                <div className="relative aspect-square bg-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded-full bg-volt px-2 py-0.5 tag font-bold text-ink">
                    Ready
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate font-bold text-white">{p.title}</p>
                  <p className="truncate text-xs text-smoke">
                    {p.artistName}
                    {p.size ? ` · ${p.size}` : ""} · {categoryLabel(p.category)}
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-white">
                    <Money cents={p.askCents} />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Want it made your way? Show who's open, with real numbers. */}
      {openDesks.length > 0 && (
        <div className="mt-12">
          <h2 className="display text-2xl text-white">Taking commissions now</h2>
          <p className="mt-1 max-w-2xl text-sm text-smoke">
            Want it built your way instead? These makers are open, with their starting price
            and turnaround posted upfront — no guessing, no DM required.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {openDesks.map((a) => (
              <Link
                key={a.slug}
                href={`/artists/${a.slug}`}
                className="rounded-xl border border-edge bg-surface p-4 transition hover:border-volt/50"
              >
                <p className="font-bold text-white">{a.displayName}</p>
                <div className="mt-2">
                  <CommissionDesk desk={a} compact />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
