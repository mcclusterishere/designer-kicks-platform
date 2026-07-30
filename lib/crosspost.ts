import { prisma } from "./db";
import { siteUrl } from "./articles";
import { publishPieceToAccount } from "./metaPublish";

/**
 * When a piece clears review, it doesn't just go to the house channels
 * — it rides out on the ARTIST'S own connected accounts too, written in
 * their voice, pointing back at their page here.
 *
 * This is the whole promise of the channels card: connect once, and
 * every approved piece promotes itself from your own Instagram, your
 * own Threads, your own Facebook Page, with you doing nothing.
 *
 * Fan-out goes to the accounts of the piece's ARTIST — the person whose
 * work it is — not whoever staged or approved it. An editor onboarding
 * somebody else's shoes should never cause those shoes to appear on the
 * editor's personal feed.
 */

/**
 * Written in first person because it publishes AS the artist. The house
 * caption says "new heat from X"; this one is X talking.
 *
 * Kept under ~420 chars so the Threads variant (this text + a link)
 * stays inside Threads' 500-character cap.
 */
export function ownChannelCaption(piece: {
  title: string;
  baseShoe: string;
}): string {
  return `New piece up on The Heat Chart: "${piece.title}" — a custom ${piece.baseShoe}. It's in the arena now, and votes decide the Heat List. Go rate it.`;
}

export type FanOutResult = { provider: string; handle: string | null; ok: boolean; detail: string };

/**
 * Post one approved piece to every ACTIVE, auto-promote channel the
 * artist connected. Best-effort per channel: one dead token doesn't
 * stop the others, and nothing here throws into the approval path.
 */
export async function fanOutToArtistChannels(submissionId: string): Promise<FanOutResult[]> {
  const s = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      title: true,
      baseShoe: true,
      imageUrl: true,
      videoUrl: true,
      artist: { select: { slug: true, userId: true } },
    },
  });
  if (!s?.artist?.userId) return [];

  const accounts = await prisma.socialAccount.findMany({
    where: { userId: s.artist.userId, status: "ACTIVE", autoPromote: true },
  });
  if (accounts.length === 0) return [];

  const caption = ownChannelCaption(s);
  const link = `${siteUrl()}/artists/${s.artist.slug}?utm_source=artist-channel&utm_medium=autopost&utm_campaign=own-work`;

  const results: FanOutResult[] = [];
  for (const acct of accounts) {
    const r = await publishPieceToAccount(acct, {
      caption:
        acct.provider === "instagram"
          ? // IG captions can't carry a tappable link — say where instead.
            `${caption}\n\ntheheatchart.com — link in bio.`
          : caption,
      imageUrl: s.imageUrl,
      videoUrl: s.videoUrl,
      link,
    });
    if (r.ok) {
      await prisma.socialAccount
        .update({ where: { id: acct.id }, data: { lastPostedAt: new Date(), lastError: null } })
        .catch(() => {});
    }
    results.push({ provider: acct.provider, handle: acct.handle, ok: r.ok, detail: r.detail });
  }
  return results;
}
