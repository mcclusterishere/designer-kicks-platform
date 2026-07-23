import { spotifyEmbed, spotifyEmbedHeight } from "@/lib/spotify";

/**
 * A maker's music on their profile. Spotify links become a real inline
 * player; any other music link (DistroKid, hyperfollow, Apple Music) shows
 * a "Listen" button that opens in a new tab. Renders nothing when unset.
 */
export default function ProfileMusic({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  const embed = spotifyEmbed(url);

  return (
    <section className="mt-8">
      <p className="tag text-heat">Listen</p>
      <div className="mt-3">
        {embed ? (
          <iframe
            src={embed.src}
            title="Artist music player"
            width="100%"
            height={spotifyEmbedHeight(embed.type)}
            frameBorder={0}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            className="max-w-xl rounded-xl border border-edge"
          />
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-heat/60 px-6 py-3 tag font-bold text-heat transition hover:bg-heat/10"
          >
            ♫ Listen to the music →
          </a>
        )}
      </div>
    </section>
  );
}
