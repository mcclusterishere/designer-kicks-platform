import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logoutUser } from "@/app/account-actions";
import { computeBadges } from "@/lib/quiz";
import { formatUsd } from "@/lib/market";
import ProfileForm from "./ProfileForm";
import ClaimSaleButton from "@/components/ClaimSaleButton";

export const metadata = { title: "Your Profile — The Heat Chart" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      _count: { select: { votes: true, giveawayEntries: true, quizRuns: true } },
      artistProfile: { select: { slug: true, displayName: true, status: true } },
      ownedPieces: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        include: { artist: { select: { slug: true, displayName: true } } },
      },
    },
  });
  if (!user) redirect("/signin");

  const [wonRuns, quizAgg, pendingClaims] = await Promise.all([
    prisma.quizRun.count({ where: { userId: user.id, status: "WON" } }),
    prisma.quizRun.aggregate({
      where: { userId: user.id },
      _sum: { correctCount: true, wrongCount: true },
    }),
    prisma.sale.findMany({
      where: { buyerEmail: user.email.toLowerCase(), status: "PENDING" },
      include: {
        submission: { select: { title: true, imageUrl: true, artistName: true } },
        seller: { select: { name: true } },
      },
    }),
  ]);
  const correct = quizAgg._sum.correctCount ?? 0;
  const answered = correct + (quizAgg._sum.wrongCount ?? 0);
  const badges = computeBadges({ wins: wonRuns, answered, correct });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="tag text-volt">Your account</p>
          <h1 className="display mt-2 text-4xl text-white">
            {user.name ?? "Sneakerhead"}
          </h1>
          <p className="mt-1 text-sm text-smoke">{user.email}</p>
        </div>
        <form action={logoutUser}>
          <button className="tag text-smoke hover:text-white">Sign out</button>
        </form>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Votes cast", value: user._count.votes },
          { label: "Quiz runs", value: user._count.quizRuns },
          { label: "Heat checks passed", value: wonRuns },
          { label: "Giveaway entries", value: user._count.giveawayEntries },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-edge bg-surface p-4 text-center">
            <p className="display text-3xl text-volt">{s.value}</p>
            <p className="tag mt-1 text-smoke">{s.label}</p>
          </div>
        ))}
      </div>

      {badges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((b) => (
            <span
              key={b.key}
              title={b.description}
              className="rounded-full border border-volt/40 bg-surface px-3 py-1.5 text-sm text-white"
            >
              {b.emoji} {b.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between rounded-xl border border-edge bg-surface p-4">
        <div>
          <p className="tag text-smoke">Quiz strike credits</p>
          <p className="display text-2xl text-white">{user.credits}</p>
        </div>
        <Link href="/quiz" className="rounded-lg bg-heat px-5 py-2.5 tag font-bold text-white">
          Take The Heat Check
        </Link>
      </div>

      {/* Account type */}
      <div className="mt-4 rounded-xl border border-edge bg-surface p-4 text-sm">
        {user.artistProfile?.status === "APPROVED" ? (
          <p className="text-smoke">
            <span className="tag text-volt">✓ Artist account</span> — posting as{" "}
            <Link href={`/artists/${user.artistProfile.slug}`} className="font-bold text-volt">
              {user.artistProfile.displayName}
            </Link>
          </p>
        ) : user.artistProfile?.status === "PENDING" ? (
          <p className="text-smoke">
            <span className="tag text-heat">Artist application under review</span> —
            you&apos;ll be able to submit customs once approved.
          </p>
        ) : (
          <p className="text-smoke">
            <span className="tag text-white">Fan account</span> — vote, play, collect.
            Make customs?{" "}
            <Link href="/submit" className="text-volt underline">
              Apply for an artist account
            </Link>
            .
          </p>
        )}
      </div>

      {/* Pending sale claims — pieces waiting on this buyer */}
      {pendingClaims.length > 0 && (
        <div className="mt-10">
          <h2 className="display text-2xl text-white">
            Pending <span className="text-gradient-heat">Claims</span>
          </h2>
          <p className="mt-1 text-sm text-smoke">
            A seller recorded a sale to your email. Claiming confirms the
            purchase and puts the piece in your closet.
          </p>
          <div className="mt-4 space-y-3">
            {pendingClaims.map((sale) => (
              <div
                key={sale.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-heat/50 bg-surface p-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sale.submission.imageUrl}
                  alt={sale.submission.title}
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white">{sale.submission.title}</p>
                  <p className="text-sm text-smoke">
                    {formatUsd(sale.priceCents)} · sold by{" "}
                    {sale.seller.name ?? sale.submission.artistName}
                    {sale.evidenceUrl ? (
                      <span className="text-volt"> · evidence attached ✓</span>
                    ) : (
                      <span> · no evidence (sale will show unverified)</span>
                    )}
                  </p>
                </div>
                <ClaimSaleButton saleId={sale.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Closet — pieces this member owns */}
      <div className="mt-10 flex items-end justify-between">
        <h2 className="display text-2xl text-white">
          My <span className="text-gradient-heat">Closet</span>
        </h2>
        {user.collectorSlug && (
          <Link href={`/collectors/${user.collectorSlug}`} className="tag text-volt underline">
            Public closet →
          </Link>
        )}
      </div>
      {user.ownedPieces.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-edge bg-surface p-5 text-sm text-smoke">
          No pieces yet. When you buy a one-of-one from an artist, they
          transfer it here — your collection, on display.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {user.ownedPieces.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-xl border border-edge bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.imageUrl}
                alt={s.title}
                className="aspect-square w-full object-cover"
              />
              <div className="p-3">
                <p className="truncate text-sm font-bold text-white">{s.title}</p>
                <p className="truncate text-xs text-smoke">
                  by {s.artist?.displayName ?? s.artistName}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="display mt-10 text-2xl text-white">Your Info</h2>
      <p className="mt-1 text-sm text-smoke">
        Used for giveaway shipping and drop alerts — never shown publicly.
      </p>
      <div className="mt-4">
        <ProfileForm
          defaults={{
            name: user.name ?? "",
            phone: user.phone ?? "",
            city: user.city ?? "",
            shoeSize: user.shoeSize ?? "",
            favoriteSilhouette: user.favoriteSilhouette ?? "",
            favoriteBrands: user.favoriteBrands ?? "",
            styleInterests: user.styleInterests ?? "",
            instagram: user.instagram ?? "",
            marketingOptIn: user.marketingOptIn,
          }}
        />
      </div>
    </div>
  );
}
