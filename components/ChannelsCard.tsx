import { prisma } from "@/lib/db";
import { connectConfigured } from "@/lib/metaConnect";
import ChannelRow from "./ChannelRow";

/**
 * "Connect once, promote forever" — the onboarding card for an editor
 * or artist's own social channels.
 *
 * The pitch this card makes is the feature: link your Instagram, your
 * Threads, your Facebook Page, and every piece of yours that clears
 * review posts itself to your own audience, in your own voice, with a
 * link back to your page here. No screenshots, no reposting, no
 * remembering.
 *
 * What it deliberately does NOT offer: connecting a personal Facebook
 * profile. Meta shut that door for every app in 2018, and a button
 * that pretends otherwise would just be a broken promise with a logo
 * on it.
 */

const PROVIDERS = [
  {
    key: "instagram" as const,
    label: "Instagram",
    need: "Business or Creator account (switch free in IG settings — personal accounts can't API-post)",
  },
  {
    key: "threads" as const,
    label: "Threads",
    need: "Any Threads profile",
  },
  {
    key: "facebook_page" as const,
    label: "Facebook Page",
    need: "A Page you admin — personal profiles can't be posted to by any app",
  },
];

export default async function ChannelsCard({
  userId,
  connectedFlag,
}: {
  userId: string;
  /** The ?connected= flag the OAuth callback lands with. */
  connectedFlag?: string;
}) {
  const [accounts, configured] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { userId },
      orderBy: { connectedAt: "asc" },
      select: {
        id: true, provider: true, handle: true, name: true,
        autoPromote: true, status: true, lastPostedAt: true, lastError: true,
      },
    }),
    Promise.resolve(connectConfigured()),
  ]);

  const anyConfigured = Object.values(configured).some(Boolean);

  return (
    <div className="rounded-xl border border-edge bg-surface p-5">
      <h3 className="display text-lg text-white">Your channels</h3>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-smoke">
        Connect your own accounts once. From then on, every piece of yours that goes live
        here also posts to them automatically — your feed, your followers, your credit,
        with a link back to your page. Flip any channel off whenever you want.
      </p>

      {connectedFlag === "ok" && (
        <p className="mt-3 rounded-lg border border-volt/40 bg-volt/5 px-3 py-2 text-sm text-white">
          ✓ Connected. Your next approved piece posts there on its own.
        </p>
      )}
      {connectedFlag === "no-pages" && (
        <p className="mt-3 rounded-lg border border-heat/40 bg-heat/5 px-3 py-2 text-sm text-white">
          Your Facebook login worked, but there's no Page on it — personal profiles can't be
          posted to by any app (Meta's rule, not ours). Create a free Page for your brand and
          reconnect.
        </p>
      )}
      {(connectedFlag === "failed" || connectedFlag === "declined") && (
        <p className="mt-3 rounded-lg border border-heat/40 bg-heat/5 px-3 py-2 text-sm text-white">
          {connectedFlag === "declined"
            ? "No problem — nothing was connected."
            : "That didn't go through. Try again in a minute."}
        </p>
      )}

      {!anyConfigured && (
        <p className="mt-3 text-sm text-smoke">
          Channel connections open up once the Meta app credentials land — coming soon.
        </p>
      )}

      <div className="mt-4 space-y-2">
        {PROVIDERS.filter((p) => configured[p.key]).map((p) => (
          <ChannelRow
            key={p.key}
            provider={p.key}
            label={p.label}
            need={p.need}
            accounts={accounts.filter((a) => a.provider === p.key)}
          />
        ))}
      </div>
    </div>
  );
}
