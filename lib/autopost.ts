import { prisma } from "./db";
import { siteUrl } from "./articles";
import {
  absoluteMediaUrl,
  facebookConfigured,
  instagramConfigured,
  postToFacebookPage,
  postToFacebookVideo,
  postToInstagram,
  postToInstagramReel,
} from "./social";
import { postImageToThreads, threadsConfigured } from "./threads";
import { fanOutToArtistChannels } from "./crosspost";

/**
 * The poster machine: every piece that clears review posts ITSELF — to
 * The Feed on the site, then out to the Facebook page and Instagram
 * when tokens are connected. The artist uploads, one admin tap
 * approves, and distribution happens with nobody at the keyboard.
 *
 * Fires exactly once per piece: an atomic autopostedAt claim makes
 * re-approvals and racing clicks no-ops. Social channels are
 * best-effort — a Meta hiccup never blocks the site feed post, and
 * nothing here ever throws into the approval path.
 */
export async function autopostSubmission(submissionId: string): Promise<void> {
  // Atomic claim: only the first approval flips autopostedAt.
  const claim = await prisma.submission.updateMany({
    where: { id: submissionId, status: "APPROVED", autopostedAt: null },
    data: { autopostedAt: new Date() },
  });
  if (claim.count === 0) return; // already posted, or not approved

  const s = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      title: true, artistName: true, imageUrl: true, videoUrl: true, baseShoe: true,
      artist: { select: { id: true, slug: true, displayName: true, userId: true } },
    },
  });
  if (!s) return;

  // If the artist connected their own Instagram, the HOUSE post can
  // credit them for real: a clickable @mention in the caption and a tag
  // on the media itself, which notifies them and puts the piece in
  // their Tagged tab. (Facebook Pages can't tag users via API at all —
  // there the name stays plain text, because that's the platform's
  // actual capability, not a gap in ours.)
  const igAcct = s.artist?.userId
    ? await prisma.socialAccount.findFirst({
        where: { userId: s.artist.userId, provider: "instagram", status: "ACTIVE" },
        select: { handle: true },
      })
    : null;
  const igUsername = igAcct?.handle?.replace(/^@/, "") ?? null;

  const artistName = s.artist?.displayName ?? s.artistName;
  const pagePath = s.artist?.slug ? `/artists/${s.artist.slug}` : "/heat-list";
  const body = `New heat on the chart: "${s.title}" by ${artistName} — a custom ${s.baseShoe}. Vote it up or vote it down; the culture decides.`;

  // 1. The site's own Feed — always, tokens or not.
  await prisma.feedPost.create({
    data: {
      body,
      imageUrl: s.imageUrl,
      linkUrl: pagePath,
      linkLabel: `See ${artistName} →`,
      artistId: s.artist?.id ?? null,
    },
  });

  // 2. The connected socials — tagged links so Social HQ sees what
  // each channel brings back. A piece with a clip leads with the clip
  // (FB video post + IG Reel); photo-only pieces post as photos.
  const photo = absoluteMediaUrl(s.imageUrl);
  const fbLink = `${siteUrl()}${pagePath}?utm_source=facebook&utm_medium=autopost&utm_campaign=new-heat`;
  const igCaption = `${
    igUsername ? body.replace(`by ${artistName}`, `by @${igUsername} (${artistName})`) : body
  }\n\nVote at theheatchart.com — link in bio.`;
  const threadsLink = `${siteUrl()}${pagePath}?utm_source=threads&utm_medium=autopost&utm_campaign=new-heat`;
  const results = await Promise.allSettled([
    facebookConfigured()
      ? s.videoUrl
        ? postToFacebookVideo(s.videoUrl, `${body}\n\n${fbLink}`)
        : postToFacebookPage(body, { imageUrl: photo, link: fbLink })
      : Promise.resolve(null),
    instagramConfigured()
      ? s.videoUrl
        ? postToInstagramReel(s.videoUrl, igCaption, { tagUsername: igUsername })
        : postToInstagram(photo, igCaption, { tagUsername: igUsername })
      : Promise.resolve(null),
    // House Threads gets the photo post — Threads video needs its own
    // ingestion dance and the photo travels further there anyway.
    threadsConfigured()
      ? postImageToThreads(`${body}\n\n${threadsLink}`, photo)
      : Promise.resolve(null),
  ]);
  for (const [i, r] of results.entries()) {
    const channel = ["facebook", "instagram", "threads"][i];
    if (r.status === "rejected") {
      console.error(`[autopost] ${channel} failed for ${submissionId}:`, r.reason);
    } else if (r.value && !r.value.ok) {
      console.error(`[autopost] ${channel} declined for ${submissionId}: ${r.value.detail}`);
    }
  }

  // 3. The artist's own connected channels — their voice, their feed,
  // their audience. Everything above was the house megaphone; this is
  // the artist's.
  try {
    const fanned = await fanOutToArtistChannels(submissionId);
    for (const f of fanned) {
      if (!f.ok) console.error(`[autopost] own-${f.provider} declined for ${submissionId}: ${f.detail}`);
    }
  } catch (e) {
    console.error(`[autopost] artist fan-out failed for ${submissionId}:`, e);
  }
}
