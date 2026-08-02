import { prisma } from "@/lib/db";
import { engageConfigured, listConversations } from "@/lib/metaEngage";
import {
  EventReplyForm,
  HarvestForm,
  IgLookupForm,
  InboxReplyForm,
  ModerateButtons,
  RuleButtons,
  RuleForm,
} from "./EngageForms";
import { listRecentPosts, rarityMentions } from "@/lib/commentHarvest";
import { TIER_LABEL, multipleLabel, type RarityTier } from "@/lib/rarity";

/**
 * The Engagement desk: everything people say TO us on Meta, in one
 * room — the Page inbox, IG DMs, comments and mentions — plus the
 * standing rules that answer the routine ones automatically.
 *
 * The rules section says, in the UI, the same thing the code enforces:
 * automation here only ever ANSWERS. Meta's messaging window makes
 * cold outreach impossible at the API level, and a desk that promised
 * it would be writing a check the platform can't cash.
 */
export default async function EngagePanel() {
  const on = engageConfigured();
  const webhooksOn = Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN);

  const [conversations, events, rules, recentPosts, mentions, harvested] = await Promise.all([
    on ? listConversations().catch(() => []) : Promise.resolve([]),
    prisma.metaEvent.findMany({
      where: { status: "NEW" },
      orderBy: { receivedAt: "desc" },
      take: 25,
    }),
    prisma.socialRule.findMany({ orderBy: { createdAt: "asc" } }),
    // A picker beats asking for an ID. If the Page connection predates
    // pages_read_user_content this comes back empty rather than
    // throwing, and the paste field still works.
    on ? listRecentPosts(8).catch(() => []) : Promise.resolve([]),
    rarityMentions(undefined, 12).catch(() => []),
    prisma.socialVote.count(),
  ]);

  return (
    <section className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl text-white">Engagement</h2>
        <p className="tag text-smoke">
          {on ? (webhooksOn ? "live" : "inbox live · comments need the webhook") : "waiting on Page token"}
        </p>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-smoke">
        The Page inbox, IG DMs, comments and mentions — answered from here instead of four
        different apps. Rules answer the routine ones on their own.{" "}
        <span className="text-white">Everything is a reply</span>: Meta's rules (and ours)
        don&apos;t allow messaging people who haven&apos;t messaged us first.
      </p>

      {!on && (
        <p className="mt-3 rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-smoke">
          Set FB_PAGE_ID + FB_PAGE_ACCESS_TOKEN and this desk lights up.
        </p>
      )}

      {/* ---- Live inbox ------------------------------------------- */}
      {on && (
        <div className="mt-5">
          <p className="tag text-volt">Inbox — Messenger &amp; Instagram</p>
          {conversations.length === 0 ? (
            <p className="mt-2 text-sm text-smoke">Quiet in here. Nothing waiting.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {conversations.slice(0, 8).map((c) => (
                <div key={c.id} className="rounded-lg border border-edge bg-panel p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0 text-sm text-white">
                      {c.participants.join(", ") || "Conversation"}
                      <span className="ml-2 tag text-smoke">{c.platform}</span>
                    </span>
                    <span className="tag text-smoke">{c.updatedTime.slice(0, 10)}</span>
                  </div>
                  <p className="mt-1 break-words text-sm text-smoke">{c.snippet}</p>
                  {c.senderId ? (
                    <InboxReplyForm senderId={c.senderId} />
                  ) : (
                    <p className="mt-1 text-xs text-smoke">Reply from the Meta inbox — no sender id on this one.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Comment / mention queue ------------------------------- */}
      <div className="mt-6">
        <p className="tag text-volt">New comments &amp; mentions</p>
        {!webhooksOn && (
          <p className="mt-1 text-xs text-smoke">
            These arrive by webhook — set META_WEBHOOK_VERIFY_TOKEN and subscribe the app to
            turn this stream on.
          </p>
        )}
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-smoke">Nothing new to look at.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {events.map((e) => (
              <div key={e.id} className="rounded-lg border border-edge bg-panel p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-sm text-white">
                      {e.fromName ?? "Someone"}{" "}
                      <span className="tag text-smoke">
                        {e.platform} {e.kind}
                      </span>
                    </span>
                    {e.text && <span className="block break-words text-sm text-smoke">{e.text}</span>}
                    {e.autoNote && <span className="block text-xs text-volt">{e.autoNote}</span>}
                  </span>
                  <ModerateButtons eventId={e.id} kind={e.kind} />
                </div>
                {(e.kind === "comment" || (e.kind === "message" && e.fromId)) && (
                  <EventReplyForm eventId={e.id} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Comment harvest -------------------------------------- */}
      <div className="mt-6">
        <p className="tag text-volt">Read a thread we already posted</p>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-smoke">
          The webhook above only reports comments left <span className="text-white">after</span>{" "}
          we subscribed, so every argument older than that never reached the site. This reads
          the whole thread off a post and banks it — the same table the webhook writes to, so
          a comment from March counts for exactly what one from this morning counts for.
          It reads only; it replies to nobody.
        </p>
        <p className="mt-1 max-w-2xl text-xs text-smoke/80">
          Pick a post below — Facebook&apos;s new links hide the post ID, so the buttons are
          the reliable way in. The number after each one is Facebook&apos;s own comment count.
        </p>
        <HarvestForm
          suggestions={recentPosts.map((p) => ({
            id: p.id,
            label: (p.message ?? "Post").replace(/\s+/g, " ").trim() || "Post",
            count: p.commentCount,
          }))}
        />
        {harvested > 0 && (
          <p className="mt-2 tag text-smoke">{harvested.toLocaleString()} comments banked so far</p>
        )}

        {mentions.length > 0 && (
          <div className="mt-3">
            <p className="tag text-smoke">What the room actually named</p>
            <div className="mt-2 space-y-1.5">
              {mentions.map((m) => {
                const tier = m.rarest?.rarityTier as RarityTier | null | undefined;
                const mult = multipleLabel(m.rarest?.rarityMultiple);
                return (
                  <div
                    key={m.shoeName}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-edge bg-panel px-3 py-2"
                  >
                    <span className="text-sm text-white">
                      {m.shoeName}
                      <span className="ml-2 tag text-smoke">
                        {m.mentions} mention{m.mentions === 1 ? "" : "s"}
                      </span>
                    </span>
                    {m.rarest && (
                      <span className="tag text-smoke">
                        rarest we track: {m.rarest.sku}
                        {tier && mult && tier !== "unknown" && (
                          <span className="ml-1 text-volt">
                            {TIER_LABEL[tier]} · {mult}
                          </span>
                        )}
                        {m.rarest.ebayItemUrl && (
                          <a
                            href={m.rarest.ebayItemUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-volt underline"
                          >
                            eBay
                          </a>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-smoke/80">
              Ranked by how many people said it. The eBay link is the affiliate-tagged
              listing the price sync already captured for that pair.
            </p>
          </div>
        )}
      </div>

      {/* ---- Rules ------------------------------------------------- */}
      <div className="mt-6">
        <p className="tag text-volt">Auto-answers</p>
        <p className="mt-1 text-xs text-smoke">
          Fire on things people send us — a comment containing a keyword, or someone&apos;s
          first DM. They can never start a conversation.
        </p>
        {rules.length > 0 && (
          <div className="mt-2 space-y-2">
            {rules.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-panel p-3">
                <span className="min-w-0 text-sm">
                  <span className={r.active ? "text-white" : "text-smoke line-through"}>
                    {r.kind === "dm_welcome" ? "First DM" : `Comment contains "${r.trigger}"`}
                    {" → "}
                    {r.reply}
                  </span>
                  <span className="ml-2 tag text-smoke">fired {r.fired}×</span>
                </span>
                <RuleButtons ruleId={r.id} active={r.active} />
              </div>
            ))}
          </div>
        )}
        <RuleForm />
      </div>

      {/* ---- Scout ------------------------------------------------- */}
      <div className="mt-6">
        <p className="tag text-volt">Scout an Instagram account</p>
        <p className="mt-1 text-xs text-smoke">
          Official Business Discovery lookup — follower count, bio and post count for any
          public business/creator handle. For sizing up customizers before an invite.
        </p>
        <IgLookupForm />
      </div>
    </section>
  );
}
