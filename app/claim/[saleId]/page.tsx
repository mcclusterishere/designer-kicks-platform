import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/market";

export const metadata = { title: "Claim Your Piece — The Heat Chart" };
export const dynamic = "force-dynamic";

/** you@example.com → y•••@example.com — enough to recognize, not leak. */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "your email";
  return `${user[0]}${"•".repeat(Math.max(2, Math.min(user.length - 1, 6)))}@${domain}`;
}

/**
 * The buyer's landing page — reached from a link the seller texts them
 * after an off-app sale. No auth needed to read it; claiming runs
 * through the existing flow (register with the sale's email → confirm
 * from profile → ownership + provenance transfer). This page's job is
 * to make that path obvious to someone who has never seen the site.
 */
export default async function ClaimPiecePage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const { saleId } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      submission: {
        select: {
          title: true,
          baseShoe: true,
          imageUrl: true,
          artist: { select: { displayName: true, slug: true, status: true } },
        },
      },
    },
  });
  if (!sale) notFound();

  const artistName = sale.submission.artist?.displayName ?? "the artist";
  const claimed = sale.status === "CONFIRMED";

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="tag text-volt">You bought heat</p>
      <h1 className="display mt-2 text-4xl text-white">Claim your piece.</h1>

      <div className="mt-6 overflow-hidden rounded-xl border border-edge bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sale.submission.imageUrl}
          alt={sale.submission.title}
          className="aspect-square w-full object-cover"
        />
        <div className="p-4">
          <p className="font-bold text-white">{sale.submission.title}</p>
          <p className="mt-0.5 text-sm text-smoke">
            Custom {sale.submission.baseShoe} by{" "}
            {sale.submission.artist?.status === "APPROVED" ? (
              <Link href={`/artists/${sale.submission.artist.slug}`} className="text-volt underline">
                {artistName}
              </Link>
            ) : (
              artistName
            )}
            {" · "}
            <span className="tabular-nums text-white">{formatUsd(sale.priceCents)}</span>
          </p>
        </div>
      </div>

      {claimed ? (
        <p className="mt-6 rounded-xl border border-volt/40 bg-volt/5 p-4 text-sm text-smoke">
          This piece has already been claimed — it&apos;s in its owner&apos;s
          closet on the chart. If that&apos;s you,{" "}
          <Link href="/signin" className="text-volt underline">sign in</Link>.
        </p>
      ) : (
        <>
          <ol className="mt-6 space-y-3 text-sm leading-relaxed text-smoke">
            <li>
              <span className="font-bold text-white">1.</span> Create your
              account using{" "}
              <span className="text-white">{maskEmail(sale.buyerEmail)}</span>{" "}
              — the email the seller recorded this sale under.
            </li>
            <li>
              <span className="font-bold text-white">2.</span> Confirm the
              purchase from your profile — one tap.
            </li>
            <li>
              <span className="font-bold text-white">3.</span> The piece moves
              into your closet, on the record: provenance, price history, the
              works. Then vote in battles, back {artistName}, and watch your
              piece&apos;s value on the market.
            </li>
          </ol>
          <div className="mt-6 flex gap-2">
            <Link href="/register" className="tag flex-1 rounded-lg btn-hard py-3 text-center font-bold">
              Create Account
            </Link>
            <Link
              href="/signin"
              className="tag flex-1 rounded-lg border border-edge py-3 text-center text-white transition hover:border-volt"
            >
              I Have One
            </Link>
          </div>
          <p className="mt-4 text-xs text-smoke/70">
            Verified owners can relist on the market later — with a royalty
            going back to {artistName} on every resale. That&apos;s how the
            chart works: everybody eats.
          </p>
        </>
      )}
    </div>
  );
}
