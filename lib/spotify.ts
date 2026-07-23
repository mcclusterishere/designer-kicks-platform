/**
 * Turn a Spotify share link (or URI) into its embed-player URL so a maker's
 * music plays right on their profile. Handles the modern intl- locale
 * prefix and strips tracking query params. Returns null for anything that
 * isn't a Spotify link — the caller falls back to a plain "Listen" button
 * (DistroKid / hyperfollow / Apple Music links have no inline player).
 */
export type SpotifyEmbed = { src: string; type: string };

export function spotifyEmbed(url: string | null | undefined): SpotifyEmbed | null {
  if (!url) return null;
  let m = url.match(
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/i
  );
  if (!m) m = url.match(/spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)/i);
  if (!m) return null;
  const type = m[1].toLowerCase();
  return { src: `https://open.spotify.com/embed/${type}/${m[2]}?utm_source=heatchart`, type };
}

/** A single track/episode gets the compact player; collections get the tall one. */
export function spotifyEmbedHeight(type: string): number {
  return type === "track" || type === "episode" ? 152 : 352;
}

/** True for any link we accept as "music" (Spotify or a distro/store link). */
export function isMusicLink(url: string): boolean {
  return /open\.spotify\.com|spotify:|distrokid\.com|hyperfollow|ffm\.to|found\.ee|music\.apple\.com|soundcloud\.com|bandcamp\.com|linktr\.ee/i.test(
    url
  );
}
