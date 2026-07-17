import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { getArtistBySlug, getArtistTrophies } from "@/lib/artists";
import FollowButton from "@/components/FollowButton";
import RecordSaleForm from "@/components/RecordSaleForm";
import { formatUsd } from "@/lib/market";

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
  const [following, trophies, heat] = await Promise.all([
    session?.user?.id
      ? prisma.artistFollow
          .findUnique({
            where: { artistId_userId: { artistId: artist.id, userId: session.user.id } },
          })
          .then(Boolean)
      : false,
    getArtistTrophies(artist.id),
    getHeatList(),
  ]);
  // Every shoe's live position on the Heat List
  const heatRank = new Map(heat.map((h, i) => [h.id, i + 1]));
  // The artist managing their own page can record sales/transfers.
  const isOwnPage = session?.user?.id === artist.userId;

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
        <FollowButton
          artistId={artist.id}
          initialFollowing={following}
          isAuthed={Boolean(session?.user)}
        />
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

      {/* Trophy Shelf — championship hardware */}
      <h2 className="display mt-10 text-2xl text-white">
        Trophy <span className="text-gradient-volt">Shelf</span>
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
              <span className="text-4xl">🏆</span>
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
        The <span className="text-gradient-heat">Closet</span>
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
                      {"🏆".repeat(Math.min(s.tournamentsWon.length, 3))}
                    </span>
                  )}
                  {pendingSale && (
                    <span className="tag absolute bottom-2 left-2 rounded bg-heat px-2 py-1 font-bold text-white">
                      ⏳ Sale Pending
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="tag text-smoke">{s.baseShoe}</p>
                  <p className="mt-1 font-bold text-white">{s.title}</p>
                  <p className="mt-1 text-sm text-smoke">
                    {s._count.battlesWon}W–{shoeBattles - s._count.battlesWon}L ·{" "}
                    {s._count.votes} votes
                    {s.tournamentsWon.length > 0 && (
                      <span className="text-volt"> · champion</span>
                    )}
                  </p>
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
                  {isOwnPage && !pendingSale && !s.owner && <RecordSaleForm submissionId={s.id} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
