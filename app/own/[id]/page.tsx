import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import ConfirmOwner from "./ConfirmOwner";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Confirm your piece — The Heat Chart",
  robots: { index: false, follow: false },
};

/**
 * "Is this yours?" — the owner's side of the handshake.
 *
 * Public by design: the person who owns the piece may have no account,
 * and making them create one before they can even see what they're being
 * asked about is how a verification link goes unclicked.
 *
 * So the page shows the piece and the maker, and nothing else. It never
 * renders the email, phone or address on file — the recipient already
 * knows their own details, and anyone who guessed the URL must learn
 * nothing about a stranger.
 */
export default async function OwnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const piece = await prisma.submission.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      size: true,
      ownershipStatus: true,
      ownerVerifiedAt: true,
      artist: { select: { displayName: true, slug: true } },
    },
  });
  if (!piece || piece.ownershipStatus !== "SOLD") notFound();

  const session = await auth();

  if (piece.ownerVerifiedAt) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="tag text-volt">Already confirmed</p>
        <h1 className="display mt-2 text-3xl text-white">{piece.title}</h1>
        <p className="mt-3 text-smoke">
          This one&apos;s logged. Nothing else to do.
        </p>
        <Link href="/profile" className="mt-6 inline-block rounded-lg btn-hard px-6 py-3 tag font-bold">
          Open your closet
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <p className="tag text-volt">Confirm ownership</p>
      <h1 className="display mt-2 text-4xl text-white">Is this yours?</h1>

      <div className="mt-6 overflow-hidden rounded-xl border border-edge bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={piece.imageUrl} alt={piece.title} className="aspect-square w-full object-cover" />
        <div className="p-4">
          <p className="display text-2xl text-white">{piece.title}</p>
          <p className="mt-1 text-sm text-smoke">
            by {piece.artist?.displayName ?? "an independent maker"}
            {piece.size && ` · size ${piece.size}`}
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm text-smoke">
        {piece.artist?.displayName ?? "The maker"} recorded that you own this. Confirming logs it
        to you publicly — a collector page with your name on it, provenance on the record, and a
        real resale value if you ever sell it on.
      </p>

      <div className="mt-6">
        <ConfirmOwner submissionId={piece.id} signedIn={Boolean(session?.user?.id)} />
      </div>

      <p className="mt-6 text-xs text-smoke">
        Not yours? Close this and nothing happens — we won&apos;t list you as the owner. If someone
        keeps naming you in error, tell us at hello@theheatchart.com and we&apos;ll stop it.
      </p>
    </div>
  );
}
