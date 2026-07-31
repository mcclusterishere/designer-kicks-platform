import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/articles";
import GroupRunRow from "./GroupRunRow";

/**
 * The Group Run: sharing into Facebook groups, minus everything
 * annoying about it.
 *
 * Meta removed the Groups API in 2024 — no app can post into a group,
 * and the tools that claim to are browser bots gambling with the
 * operator's PERSONAL account. So the share stays a human tap, and
 * this panel strips it to exactly two taps per group: copy the caption
 * (link included, tagged for THIS group), open the group. The ✓ is
 * remembered per group per post, so stopping halfway through twenty
 * groups costs nothing.
 *
 * Every caption carries the group's own utm_campaign — the same tags
 * Group Scout mints — so Traffic Pulse shows which rooms actually send
 * people, and the dead rooms fall off the run.
 */
export default async function GroupRun() {
  const [groups, pieces, shares] = await Promise.all([
    prisma.groupLead.findMany({
      where: { stage: { not: "NEW" } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.submission.findMany({
      where: { status: "APPROVED", artistId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        title: true,
        baseShoe: true,
        artistName: true,
        artist: { select: { slug: true } },
      },
    }),
    prisma.groupShare.findMany({
      orderBy: { sharedAt: "desc" },
      take: 400,
      select: { groupLeadId: true, postUrl: true },
    }),
  ]);

  if (groups.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-edge bg-surface p-4">
        <p className="tag text-volt">Group Run</p>
        <p className="mt-1 text-sm text-smoke">
          Move a group past NEW in the pipeline above and it joins the run — every post,
          two taps per group, with a ✓ that remembers where you stopped.
        </p>
      </div>
    );
  }

  const base = siteUrl();
  // What's worth sharing right now: the freshest approved pieces, the
  // giveaway, and the arena. Captions are written to read like a person
  // sharing heat, not a brand distributing content.
  const shareables = [
    ...pieces.map((p) => ({
      key: `piece-${p.id}`,
      title: `"${p.title}" by ${p.artistName}`,
      path: p.artist?.slug ? `/artists/${p.artist.slug}` : "/heat-list",
      caption: `One-of-one ${p.baseShoe} by ${p.artistName} just hit The Heat Chart — the custom-sneaker league where votes decide who runs the culture. Rate it here:`,
    })),
    {
      key: "giveaway",
      title: "The vest giveaway",
      path: "/giveaway",
      caption: `We're giving away a 1-of-1 custom vest, hand-built by Hitman Halo — free entries, no purchase. If you know custom culture, come take your shot:`,
    },
    {
      key: "arena",
      title: "The Arena (battles)",
      path: "/battles",
      caption: `Custom sneaker battles, head to head, and the culture votes the winners. The Arena is live — pick a side:`,
    },
  ];

  const shared = new Set(shares.map((s) => `${s.groupLeadId}|${s.postUrl}`));

  return (
    <div className="mt-4 rounded-xl border border-edge bg-surface p-4">
      <p className="tag text-volt">Group Run</p>
      <p className="mt-1 text-sm text-smoke">
        Pick a post, run the list: copy → open → paste → ✓. Each caption carries that
        group&apos;s tracked link, so the clicks show up per-group in Traffic Pulse.
      </p>
      <div className="mt-3 space-y-4">
        {shareables.map((s) => {
          const doneCount = groups.filter((g) =>
            shared.has(`${g.id}|${base}${s.path}`)
          ).length;
          return (
            <details key={s.key} className="rounded-lg border border-edge bg-panel p-3">
              <summary className="cursor-pointer text-sm text-white">
                {s.title}{" "}
                <span className="tag text-smoke">
                  {doneCount}/{groups.length} groups
                </span>
              </summary>
              <div className="mt-2 space-y-2">
                {groups.map((g) => (
                  <GroupRunRow
                    key={g.id}
                    groupId={g.id}
                    groupName={g.name}
                    groupUrl={g.url}
                    postTitle={s.title}
                    postUrl={`${base}${s.path}`}
                    caption={`${s.caption} ${base}${s.path}?utm_source=facebook&utm_medium=group&utm_campaign=${encodeURIComponent(g.campaign)}`}
                    done={shared.has(`${g.id}|${base}${s.path}`)}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
