import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { finalizeExpiredBattles } from "@/lib/battles";
import { getArtistBySlug } from "@/lib/artists";
import FollowButton from "@/components/FollowButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const artist = await prisma.artistProfile.findUnique({ where: { slug } });
  if (!artist) return { title: "Artist not found" };
  return {
    title: `${artist.displayName} — Custom Sneaker Artist | Designer Kicks`,
    description: `${artist.displayName}'s customs, battle record, and league ranking on Designer Kicks.`,
  };
}

export default async function ArtistPage({ params }: Props) {
  const { slug } = await params;
  await finalizeExpiredBattles();

  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();

  const session = await auth();
  const following = session?.user?.id
    ? Boolean(
        await prisma.artistFollow.findUnique({
          where: { artistId_userId: { artistId: artist.id, userId: session.user.id } },
        })
      )
    : false;

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

      <h2 className="display mt-10 text-2xl text-white">The Portfolio</h2>
      {artist.submissions.length === 0 ? (
        <p className="mt-4 text-smoke">No approved customs yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {artist.submissions.map((s) => {
            const shoeBattles =
              s.battlesAsA.filter((b) => b.status === "COMPLETED").length +
              s.battlesAsB.filter((b) => b.status === "COMPLETED").length;
            return (
              <div key={s.id} className="overflow-hidden rounded-xl border border-edge bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.imageUrl}
                  alt={`${s.title} — custom ${s.baseShoe}`}
                  className="aspect-square w-full object-cover"
                />
                <div className="p-4">
                  <p className="tag text-smoke">{s.baseShoe}</p>
                  <p className="mt-1 font-bold text-white">{s.title}</p>
                  <p className="mt-1 text-sm text-smoke">
                    {s._count.battlesWon}W–{shoeBattles - s._count.battlesWon}L ·{" "}
                    {s._count.votes} votes
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
