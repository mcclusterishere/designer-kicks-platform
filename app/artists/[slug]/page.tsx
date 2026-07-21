import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { getArtistBySlug, getArtistTrophies } from "@/lib/artists";
import CultureVerified from "@/components/CultureVerified";
import FollowButton from "@/components/FollowButton";
import RecordSaleForm from "@/components/RecordSaleForm";
import AddPhotosForm from "@/components/AddPhotosForm";
import ClaimProfileForm from "@/components/ClaimProfileForm";
import { isAdmin } from "@/lib/admin";
import { formatUsd } from "@/lib/market";
import { platformLabel } from "@/lib/sellPlatforms";
import { categoryLabel } from "@/lib/categories";
import HeatScore from "@/components/HeatScore";
import ChallengeButton from "@/components/ChallengeButton";
import DonorShoe from "@/components/DonorShoe";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const artist = await prisma.artistProfile.findUnique({ where: { slug } });
  if (!artist) return { title: "Artist not found" };
  return {
    title: `${artist.displayName} — Custom Sneaker Artist | The Heat Chart`,
    description: `${artist.displayName}'s customs, battle record, and league ranking on The Heat Chart.`,
  };
}

export default async function ArtistPage({ params }: Props) {
  const { slug } = await params;
  await finalizeExpiredBattles();

  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();

  const session = await auth();
  const [following, trophies, heat, shops] = await Promise.all([
    session?.user?.id
      ? prisma.artistFollow
          .findUnique({
            where: { artistId_userId: { artistId: artist.id, userId: session.user.id } },
          })
          .then(Boolean)
      : false,
    getArtistTrophies(artist.id),
    getHeatList(),
    prisma.artistShop.findMany({ where: { artistId: artist.id }, orderBy: { createdAt: "asc" } }),
  ]);
  // Every shoe's live position on the Heat List
  const heatRank = new Map(heat.map((h, i) => [h.id, i + 1]));
  // The artist managing their own page can record sales/transfers;
  // an admin can also curate galleries for pre-loaded artists.
  const isOwnPage = session?.user?.id === artist.userId;
  const admin = await isAdmin();
  // A rival approved artist standing on this page can throw challenges.
  const viewerProfile = session?.user?.id
    ? await prisma.artistProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true, status: true },
      })
    : null;
  const viewerCanChallenge =
    viewerProfile?.status === "APPROVED" && viewerProfile.id !== artist.id;
  // Pre-loaded pages stay claimable until the artist sets a login.
  const claimable = !artist.user.passwordHash && artist.user._count.accounts === 0;

  // Raw page-view counting for the Studio dashboard — own visits excluded.
  if (!isOwnPage) {
    await prisma.artistProfile
      .update({ where: { id: artist.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
  }

  let wins = 0;
  let battles = 0;
  let totalVotes = 0;
  for (const s of artist.submissions) {
    wins += s._count.battlesWon;
    battles +=
      s.battlesAsA.filter((b) => b.status === "COMPLETED").length +
      s.battlesAsB.filter((b) => b.status === "COMPLETED").length;
    totalVotes += s._count.votes;
  }
  const winRate = battles > 0 ? Math.round((wins / battles) * 100) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link href="/artists" className="tag text-smoke hover:text-white">
        ← League rankings
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="tag text-volt">Artist</p>
          <h1 className="display mt-1 text-4xl text-white sm:text-5xl">
            {artist.displayName}
          </h1>
          {artist.userId && (
            <div className="mt-2">
              <CultureVerified detail="Claimed" />
            </div>
          )}
          <p className="mt-2 text-sm text-smoke">
            {artist.instagram && (
              <a
                href={`https://instagram.com/${artist.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-volt hover:underline"
              >
                @{artist.instagram}
              </a>
            )}
            {artist.instagram && artist.city && " · "}
            {artist.city}
          </p>
          {artist.bio && <p className="mt-3 max-w-xl text-smoke">{artist.bio}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {isOwnPage && (
            <Link
              href="/studio"
              className="btn-hard rounded-lg px-4 py-2.5 tag font-bold"
            >
              Open Your Studio
            </Link>
          )}
          <FollowButton
            artistId={artist.id}
            initialFollowing={following}
            isAuthed={Boolean(session?.user)}
          />
          {artist.instagram && !isOwnPage && (
            <a
              href={`https://instagram.com/${artist.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tag rounded-lg bg-heat px-4 py-2.5 font-bold text-white glow-heat transition hover:opacity-90"
            >
              Book a Commission
            </a>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Record", value: `${wins}W–${battles - wins}L` },
          { label: "Win rate", value: winRate === null ? "—" : `${winRate}%` },
          { label: "Total votes", value: totalVotes },
          { label: "Followers", value: artist._count.followers },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-edge bg-surface p-4 text-center">
            <p className="display text-2xl text-volt">{s.value}</p>
            <p className="tag mt-1 text-smoke">{s.label}</p>
          </div>
        ))}
      </div>

      {claimable && (
        <ClaimProfileForm artistId={artist.id} displayName={artist.displayName} />
      )}

      {/* Shop their work — the artist's own storefronts */}
      {shops.length > 0 && (
        <div className="mt-8">
          <p className="tag text-smoke">Shop their work</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {shops.map((s) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="tag rounded-full border border-volt/50 px-4 py-2 text-volt transition hover:border-volt hover:bg-volt/10"
              >
                {s.label || platformLabel(s.platform)} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Trophy Shelf — championship hardware */}
      <h2 className="display mt-10 text-2xl text-white">
        Trophy Shelf
      </h2>
      {trophies.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-edge bg-surface p-5 text-sm text-smoke">
          The shelf is waiting. Win a championship bracket and the trophy
          lives here forever.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {trophies.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.slug}`}
              className="flex items-center gap-4 rounded-xl border border-volt/60 bg-surface p-4 glow-volt transition hover:border-volt"
            >
              <span className="display text-3xl text-volt">W</span>
              <div className="min-w-0">
                <p className="truncate font-bold text-white">{t.name}</p>
                <p className="truncate text-sm text-smoke">
                  Champion with{" "}
                  <span className="text-volt">{t.champion?.title}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* The Closet — every one-of-one, with its live heat rank */}
      <h2 className="display mt-10 text-2xl text-white">
        The Closet
      </h2>
      <p className="mt-1 text-sm text-smoke">
        Every one-of-one in the collection, ranked live on the{" "}
        <Link href="/heat-list" className="text-volt underline">Heat List</Link>.
      </p>
      {artist.submissions.length === 0 ? (
        <p className="mt-4 text-smoke">No approved customs yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {artist.submissions.map((s) => {
            const shoeBattles =
              s.battlesAsA.filter((b) => b.status === "COMPLETED").length +
              s.battlesAsB.filter((b) => b.status === "COMPLETED").length;
            const rank = heatRank.get(s.id);
            const pendingSale = s.sales.find((sale) => sale.status === "PENDING");
            const lastSale = s.sales.find((sale) => sale.status === "CONFIRMED");
            return (
              <div key={s.id} className="group overflow-hidden rounded-xl border border-edge bg-surface transition hover:border-volt/50">
                <div className="relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.imageUrl}
                    alt={`${s.title} — custom ${s.baseShoe}`}
                    className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                  {rank && (
                    <span
                      className={`tag absolute left-2 top-2 rounded px-2 py-1 font-bold ${
                        rank <= 3 ? "bg-volt text-ink" : "bg-ink/85 text-volt"
                      }`}
                    >
                      #{rank} Heat
                    </span>
                  )}
                  {s.tournamentsWon.length > 0 && (
                    <span
                      className="absolute right-2 top-2 rounded bg-ink/85 px-2 py-1 text-sm"
                      title={s.tournamentsWon.map((t) => t.name).join(", ")}
                    >
                      {s.tournamentsWon.length > 0 ? `Champion ×${s.tournamentsWon.length}` : ""}
                    </span>
                  )}
                  {pendingSale && (
                    <span className="tag absolute bottom-2 left-2 rounded bg-heat px-2 py-1 font-bold text-white">
                      ⏳ Sale Pending
                    </span>
                  )}
                </div>
                {s.videoUrl && (
                  <video
                    src={s.videoUrl}
                    controls
                    preload="metadata"
                    playsInline
                    className="w-full border-t border-edge bg-ink"
                    aria-label={`Video of ${s.title}`}
                  />
                )}
                <div className="p-4">
                  <p className="tag text-smoke">{categoryLabel(s.category)} · {s.baseShoe}{s.size && <span className="text-white"> · {s.size}</span>}</p>
                  <p className="mt-1 font-bold text-white">{s.title}</p>
                  {s.collaborators.length > 0 && (
                    <p className="mt-0.5 text-sm text-smoke">
                      with{" "}
                      {s.collaborators.map((c, i) => (
                        <span key={c.slug}>
                          {i > 0 && " × "}
                          <Link href={`/artists/${c.slug}`} className="text-volt underline">
                            {c.displayName}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-smoke">
                    {s._count.battlesWon}W–{shoeBattles - s._count.battlesWon}L ·{" "}
                    {s._count.votes} votes
                    {s.tournamentsWon.length > 0 && (
                      <span className="text-volt"> · champion</span>
                    )}
                  </p>
                  <HeatScore stars={s.ratings.map((r) => r.stars)} />
                  {s.category === "sneakers" && (
                    <DonorShoe
                      brand={s.brand}
                      silhouette={s.silhouette}
                      baseShoe={s.baseShoe}
                      baseColorway={s.baseColorway}
                      refTag={`piece:${s.id}`}
                      compact
                    />
                  )}
                  {viewerCanChallenge && <ChallengeButton targetSubmissionId={s.id} />}
                  {lastSale && (
                    <p className="mt-1 text-sm">
                      <span className="font-bold text-white">{formatUsd(lastSale.priceCents)}</span>{" "}
                      {lastSale.verified ? (
                        <span className="tag text-volt" title="Sale substantiated with evidence or admin-verified">✓ verified sale</span>
                      ) : (
                        <span className="tag text-smoke">unverified sale</span>
                      )}
                    </p>
                  )}
                  {s.owner && (
                    <p className="mt-1.5 text-sm text-smoke">
                      🔑 In{" "}
                      {s.owner.collectorSlug ? (
                        <Link
                          href={`/collectors/${s.owner.collectorSlug}`}
                          className="text-volt underline"
                        >
                          {s.owner.name ?? "a collector"}&apos;s closet
                        </Link>
                      ) : (
                        <span className="text-white">{s.owner.name ?? "a collector"}&apos;s closet</span>
                      )}
                    </p>
                  )}
                  {(isOwnPage || admin) && (
                    <AddPhotosForm submissionId={s.id} photoCount={1 + s.extraImages.length} />
                  )}
                  {isOwnPage && !pendingSale && !s.owner && <RecordSaleForm submissionId={s.id} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Collabs — pieces co-built with other artists on the chart.
          The piece lives on the primary artist's page; this shelf makes
          sure the co-signer's page shows the work too. */}
      {artist.collabs.length > 0 && (
        <>
          <h2 className="display mt-14 text-3xl text-white">Collabs</h2>
          <p className="mt-1 text-sm text-smoke">
            Built with other artists in the league — two names, one piece.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {artist.collabs.map((c) => (
              <Link
                key={c.id}
                href={c.artist?.status === "APPROVED" ? `/artists/${c.artist.slug}` : "/heat-list"}
                className="group overflow-hidden rounded-xl border border-edge bg-surface transition hover:border-volt/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.imageUrl}
                  alt={`${c.title} — collab piece`}
                  className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                />
                <div className="p-3">
                  <p className="truncate text-sm font-bold text-white">{c.title}</p>
                  <p className="mt-0.5 truncate text-xs text-smoke">
                    with {c.artist?.displayName ?? c.artistName}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
