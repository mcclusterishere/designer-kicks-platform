import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logoutUser } from "@/app/account-actions";
import { computeBadges } from "@/lib/quiz";
import { getTasteProfile } from "@/lib/taste";
import { formatUsd } from "@/lib/market";
import { categoryEmoji } from "@/lib/categories";
import ProfileForm from "./ProfileForm";
import ClaimSaleButton from "@/components/ClaimSaleButton";
import FitBuilder from "@/components/FitBuilder";
import { respondOffer, withdrawOffer } from "@/app/actions";

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

  const [wonRuns, quizAgg, pendingClaims, incomingOffers, myOffers, taste] = await Promise.all([
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
    // Open offers on pieces this member currently sells: pieces they
    // own, or their unsold artist pieces (no owner yet).
    prisma.offer.findMany({
      where: {
        status: "OPEN",
        submission: {
          sales: { none: { status: "PENDING" } },
          OR: [
            { ownerId: user.id },
            { ownerId: null, artist: { userId: user.id } },
          ],
        },
      },
      orderBy: { amountCents: "desc" },
      include: {
        submission: { select: { title: true, imageUrl: true } },
        buyer: { select: { name: true } },
      },
    }),
    prisma.offer.findMany({
      where: { buyerId: user.id, status: "OPEN" },
      include: { submission: { select: { title: true } } },
    }),
    getTasteProfile(user.id),
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
            {" · "}
            <Link href="/studio" className="text-volt underline">
              Studio →
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

      {/* Taste profile — what this fan's votes, ratings, and closet say */}
      <div id="taste" className="mt-10 scroll-mt-24">
        <h2 className="display text-2xl text-white">
          Your <span className="text-gradient-volt">Taste</span>
        </h2>
        {!taste ? (
          <div className="mt-3 rounded-2xl border border-dashed border-edge bg-surface p-6 text-center">
            <p className="text-3xl">🔥</p>
            <p className="mt-2 text-sm text-smoke">
              The chart hasn&apos;t learned your taste yet. Vote in battles or
              play a round of Rate the Heat and this becomes your style
              fingerprint.
            </p>
            <Link href="/rate" className="btn-hard mt-4 inline-block rounded-xl px-6 py-3 tag font-bold">
              Rate The Heat →
            </Link>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-volt/30 bg-surface shadow-2xl">
            {/* Archetype masthead */}
            <div className="flex items-center gap-4 border-b border-edge bg-gradient-to-r from-volt/10 via-transparent to-heat/10 p-5">
              <span className="text-4xl">{taste.archetype.emoji}</span>
              <div>
                <p className="display text-2xl text-white">{taste.archetype.title}</p>
                <p className="mt-0.5 text-sm text-smoke">{taste.archetype.blurb}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
              {taste.brands.length > 0 && (
                <div>
                  <p className="tag text-smoke">Brand DNA</p>
                  <div className="mt-2 space-y-2">
                    {taste.brands.slice(0, 4).map((b) => (
                      <div key={b.name}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-white">{b.name}</span>
                          <span className="tabular text-xs text-volt">{b.share}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-panel">
                          <div
                            className="bar-animate h-full rounded-full bg-gradient-to-r from-volt to-heat"
                            style={{ width: `${b.share}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-4">
                {taste.silhouettes.length > 0 && (
                  <div>
                    <p className="tag text-smoke">Go-To Silhouettes</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {taste.silhouettes.slice(0, 4).map((s) => (
                        <span key={s.name} className="rounded-full border border-volt/40 bg-volt/5 px-3 py-1 text-xs text-white">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {taste.artists.length > 0 && (
                  <div>
                    <p className="tag text-smoke">Artists You Back</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {taste.artists.slice(0, 3).map((a) => (
                        <span key={a.name} className="rounded-full border border-edge bg-panel px-3 py-1 text-xs text-smoke">
                          🎨 {a.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {taste.colorways.length > 0 && (
                  <div>
                    <p className="tag text-smoke">Colorway Roots</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {taste.colorways.slice(0, 3).map((c) => (
                        <span key={c.name} className="rounded-full border border-edge bg-panel px-3 py-1 text-xs text-smoke">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge px-5 py-3">
              <p className="tag text-smoke">
                Built from {taste.signalCount} signal{taste.signalCount === 1 ? "" : "s"} —
                votes, ratings, closet, offers
              </p>
              <Link href="/rate" className="tag text-volt underline">
                Sharpen it → Rate the Heat
              </Link>
            </div>
          </div>
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

      {/* Offers on pieces this member is selling */}
      {incomingOffers.length > 0 && (
        <div className="mt-10">
          <h2 className="display text-2xl text-white">
            Offers On <span className="text-gradient-volt">Your Pieces</span>
          </h2>
          <p className="mt-1 text-sm text-smoke">
            Accepting records the sale to the buyer — they confirm it from
            their account and ownership transfers with full provenance.
          </p>
          <div className="mt-4 space-y-3">
            {incomingOffers.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-volt/50 bg-surface p-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={o.submission.imageUrl}
                  alt={o.submission.title}
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white">{o.submission.title}</p>
                  <p className="text-sm text-smoke">
                    <span className="display text-lg text-volt">{formatUsd(o.amountCents)}</span>{" "}
                    from {o.buyer.name ?? "a collector"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={respondOffer.bind(null, o.id, true)}>
                    <button className="tag rounded bg-volt px-4 py-2 font-bold text-ink">
                      Accept
                    </button>
                  </form>
                  <form action={respondOffer.bind(null, o.id, false)}>
                    <button className="tag rounded border border-edge px-4 py-2 text-smoke hover:border-heat hover:text-heat">
                      Decline
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* This member's open offers on other people's pieces */}
      {myOffers.length > 0 && (
        <div className="mt-10">
          <h2 className="display text-2xl text-white">
            Your Open <span className="text-gradient-heat">Offers</span>
          </h2>
          <div className="mt-4 space-y-2">
            {myOffers.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
              >
                <p className="text-smoke">
                  <span className="text-white">{formatUsd(o.amountCents)}</span> on{" "}
                  <span className="text-white">{o.submission.title}</span> — waiting on the seller
                </p>
                <form action={withdrawOffer.bind(null, o.id)}>
                  <button className="tag text-smoke hover:text-heat">Withdraw</button>
                </form>
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
                  {categoryEmoji(s.category)} by {s.artist?.displayName ?? s.artistName}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Build a Fit — enter the fit battles with owned pieces */}
      {user.ownedPieces.length >= 2 && (
        <div className="mt-10">
          <h2 className="display text-2xl text-white">
            Build a <span className="text-gradient-volt">Fit</span>
          </h2>
          <p className="mt-1 text-sm text-smoke">
            Style 2–5 pieces from your closet into a full look and enter the{" "}
            <Link href="/outfits" className="text-volt underline">
              Fit Battles
            </Link>{" "}
            — your fit can face other fans or the house itself, decided by
            the culture&apos;s votes.
          </p>
          <FitBuilder
            pieces={user.ownedPieces.map((s) => ({
              id: s.id,
              title: s.title,
              imageUrl: s.imageUrl,
              category: s.category,
            }))}
          />
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
