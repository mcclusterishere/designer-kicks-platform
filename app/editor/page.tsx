import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUserRole, getOnboardingStats, type OnboardingStats } from "@/lib/editor";
import { isAdmin } from "@/lib/admin";
import { facebookConfigured, instagramConfigured } from "@/lib/social";
import ArticleForm from "@/app/admin/ArticleForm";
import PreloadArtistForm from "@/app/admin/PreloadArtistForm";
import { OutreachRow } from "@/app/admin/OutfitStudioForms";
import EditorBroadcastForm from "./EditorBroadcastForm";
import StageProspectForm from "./StageProspectForm";
import MessageOffice from "./MessageOffice";
import OnboardAgent from "./OnboardAgent";
import LeadFinder from "./LeadFinder";
import CopyField from "./CopyField";

export const metadata = { title: "Your workspace — The Heat Chart", robots: { index: false } };
export const dynamic = "force-dynamic";

function ago(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---- Calm building blocks ----
function StatTile({ value, label, tone = "ink" }: { value: React.ReactNode; label: string; tone?: "sage" | "clay" | "ink" }) {
  const c = tone === "sage" ? "text-[var(--d-sage)]" : tone === "clay" ? "text-[var(--d-clay)]" : "text-[var(--d-ink)]";
  return (
    <div className="rounded-xl border border-[var(--d-line)] bg-[var(--d-raise)] px-4 py-3.5">
      <p className={`text-2xl font-semibold leading-none ${c}`}>{value}</p>
      <p className="mt-2 text-xs text-[var(--d-soft)]">{label}</p>
    </div>
  );
}

function Panel({
  id, index, title, count, desc, children,
}: {
  id: string; index: string; title: string;
  count?: number; desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="overflow-hidden rounded-2xl border border-[var(--d-line)] bg-[var(--d-raise)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--d-line)] bg-[var(--d-panel)] px-6 py-4">
          <span className="text-sm font-medium text-[var(--d-sage)]">{index}</span>
          <h2 className="text-lg font-semibold text-[var(--d-ink)]">{title}</h2>
          {count != null && count > 0 && (
            <span className="rounded-full border border-[var(--d-line)] px-2 py-0.5 text-xs text-[var(--d-soft)]">
              {count}
            </span>
          )}
          {desc && <p className="ml-auto hidden max-w-md text-right text-sm text-[var(--d-soft)] lg:block">{desc}</p>}
        </div>
        <div className="p-6">{children}</div>
      </div>
    </section>
  );
}

// A quiet sub-header inside a panel.
function Sub({ step, title, hint }: { step: string; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--d-sage)]">{step}</span>
      <h3 className="text-sm font-semibold text-[var(--d-ink)]">{title}</h3>
      {hint && <p className="text-sm text-[var(--d-soft)]">{hint}</p>}
    </div>
  );
}

const NAV = [
  { id: "onboard", label: "Onboard" },
  { id: "content", label: "Content" },
  { id: "socials", label: "Share" },
  { id: "office", label: "Office" },
];

// Which channels can go out for free right now, and how.
function FreeSocials({ fb, ig }: { fb: boolean; ig: boolean }) {
  const rows: Array<{ name: string; state: string; tone: "on" | "paste" | "off" }> = [
    { name: "The Feed (on-site)", state: "Live — one click", tone: "on" },
    { name: "Facebook Page", state: fb ? "Connected — one click" : "Office adds a token", tone: fb ? "on" : "off" },
    { name: "Instagram", state: ig ? "Connected — one click (add a photo)" : "Office adds a token", tone: ig ? "on" : "off" },
    { name: "YouTube Shorts", state: "Free — copy & paste", tone: "paste" },
    { name: "X / Twitter", state: "Free — copy & paste", tone: "paste" },
    { name: "TikTok", state: "Free — copy & paste", tone: "paste" },
    { name: "Threads · Reddit · anywhere", state: "Free — copy & paste", tone: "paste" },
  ];
  const dot = (t: "on" | "paste" | "off") =>
    t === "on" ? "bg-[var(--d-sage)]" : t === "paste" ? "bg-[var(--d-soft)]" : "bg-[var(--d-faint)]";
  return (
    <div className="rounded-xl border border-[var(--d-line)] bg-[var(--d-panel)] p-5">
      <p className="text-sm font-medium text-[var(--d-ink)]">Free to post right now</p>
      <ul className="mt-3 divide-y divide-[var(--d-line)]">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="flex items-center gap-2.5 text-[var(--d-ink)]">
              <span className={`h-1.5 w-1.5 rounded-full ${dot(r.tone)}`} />
              {r.name}
            </span>
            <span className="text-sm text-[var(--d-soft)]">{r.state}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-[var(--d-soft)]">
        Post once below and the site plus any connected channels go out together — you
        also get clean, paste-ready text for the rest. No rush to do them all.
      </p>
    </div>
  );
}

// The gentle scoreboard — today's count, all-time, earnings, your link.
function Scoreboard({ stats }: { stats: OnboardingStats }) {
  const pct = Math.min(100, Math.round((stats.doneToday / stats.quota) * 100));
  const earned = `$${(stats.earningsCents / 100).toFixed(2)}`;
  const left = stats.quota - stats.doneToday;
  return (
    <div className="mt-6 space-y-5 rounded-2xl border border-[var(--d-line)] bg-[var(--d-raise)] p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--d-soft)]">Today</p>
          <p className="mt-1 text-4xl font-semibold leading-none text-[var(--d-ink)]">
            {stats.doneToday}
            <span className="text-2xl text-[var(--d-soft)]"> of {stats.quota}</span>
          </p>
        </div>
        <p className="max-w-[16rem] text-right text-sm leading-relaxed text-[var(--d-soft)]">
          {stats.doneToday >= stats.quota
            ? "That's the day — nicely done. Anything past this is a bonus."
            : `${left} to go, whenever you're ready. Steady beats a sprint.`}
          {stats.wipToday > 0 && ` · ${stats.wipToday} waiting on a 2nd pair.`}
        </p>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--d-line)]">
        <div className="calm-fill h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile value={stats.totalDone} label="Set up · all-time" tone="sage" />
        <StatTile value={earned} label="Earned · so far" tone="clay" />
        <StatTile value="$0.50" label="Each finished page" />
      </div>
      {stats.refLink && (
        <CopyField value={stats.refLink} label="Your link — anyone who visits or gets added through it is counted as yours" />
      )}
    </div>
  );
}

export default async function EditorDesk({
  searchParams,
}: {
  searchParams: Promise<{ editArticle?: string }>;
}) {
  const [me, admin] = await Promise.all([currentUserRole(), isAdmin()]);
  if (!(me?.role === "EDITOR" || admin)) redirect(me ? "/" : "/signin");

  const { editArticle } = await searchParams;
  const [articles, editArticleRow, prospects, thread, outreachLeads, stats] = await Promise.all([
    prisma.article.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    editArticle ? prisma.article.findUnique({ where: { id: editArticle } }) : null,
    me
      ? prisma.outreachProspect.findMany({ where: { stagedById: me.id }, orderBy: { createdAt: "desc" }, take: 20 })
      : Promise.resolve([]),
    me
      ? prisma.editorMessage.findMany({ where: { editorId: me.id }, orderBy: { createdAt: "asc" }, take: 50 })
      : Promise.resolve([]),
    prisma.artistProfile.findMany({
      where: { status: "APPROVED", user: { passwordHash: null, accounts: { none: {} } } },
      orderBy: [{ invitedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      include: { user: { select: { email: true } } },
    }),
    me ? getOnboardingStats(me.id, me.name || me.email || "editor") : Promise.resolve(null),
  ]);
  const daysAgo = (d: Date) => {
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  };

  const threadView = thread.map((m) => ({ id: m.id, body: m.body, fromAdmin: m.fromAdmin, ago: ago(m.createdAt) }));
  const officeUnread = thread.filter((m) => m.fromAdmin && !m.readByEditor).length;
  const firstName = (me?.name || me?.email || "there").split(/[\s@]/)[0];
  const fb = facebookConfigured();
  const ig = instagramConfigured();

  return (
    <div className="desk min-h-screen">
      {/* A soft workspace bar — no blinking, no shouting */}
      <div className="border-b border-[var(--d-line)] bg-[var(--d-panel)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3.5">
          <span className="text-sm font-semibold tracking-tight text-[var(--d-ink)]">Your&nbsp;workspace</span>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`}
                className="rounded-full px-3 py-1.5 text-sm text-[var(--d-soft)] transition hover:bg-white/[0.04] hover:text-[var(--d-ink)]">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto text-right leading-tight">
            <p className="text-sm font-medium text-[var(--d-ink)]">{me?.name || me?.email || "Editor"}</p>
            <p className="text-xs text-[var(--d-soft)]">custom brand scout{admin ? " · admin" : ""}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--d-ink)] sm:text-[2rem]">
              Hey {firstName} 👋
            </h1>
            <p className="mt-1.5 text-[var(--d-soft)]">One good page at a time. No rush — the work adds up.</p>
          </div>
          {admin && !me && (
            <span className="rounded-full border border-[var(--d-line)] px-3 py-1 text-sm text-[var(--d-clay)]">viewing as admin</span>
          )}
        </div>

        {/* The gentle scoreboard */}
        {stats ? (
          <Scoreboard stats={stats} />
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile value={articles.filter((a) => a.status === "PUBLISHED").length} label="Published" />
            <StatTile value={outreachLeads.length} label="To onboard" tone="clay" />
            <StatTile value="—" label="Onboarded" />
            <StatTile value={officeUnread} label="From office" />
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* 01 · Onboard */}
          <Panel id="onboard" index="01" title="Onboard an artist" count={outreachLeads.length}
            desc="Two pairs from one maker → a fresh page → share it.">
            <div className="mb-6 rounded-xl border border-[var(--d-line)] bg-[var(--d-sage-bg)] p-5 text-sm leading-relaxed text-[var(--d-soft)]">
              <p className="font-semibold text-[var(--d-ink)]">The rhythm — one artist, one page, $0.50:</p>
              <ol className="mt-2.5 list-decimal space-y-1.5 pl-5">
                <li>Find a custom-shoe artist and <b className="text-[var(--d-ink)]">2 pairs of their work</b>.</li>
                <li>Stage <b className="text-[var(--d-ink)]">both pieces</b> below on one fresh page — <b className="text-[var(--d-ink)]">5–6 photos each</b>.</li>
                <li>Add the 2nd pair by staging again with the <b className="text-[var(--d-ink)]">same artist email</b>.</li>
                <li>Give it a share under <a href="#socials" className="text-[var(--d-sage)] underline underline-offset-2">Share</a>.</li>
              </ol>
              <p className="mt-2.5">A page is done — and paid — once it has both pieces. A calm 20 is the day.</p>
            </div>

            {/* Find someone new */}
            <div className="mb-7">
              <Sub step="Find" title="Scout for artists" hint="The AI hunts; you pick who's worth a page." />
              <LeadFinder />
            </div>

            {/* Optional: research a lead first */}
            <div className="mb-7">
              <Sub step="Optional" title="Research a lead first" hint="Turn a link into a drafted page." />
              <OnboardAgent />
            </div>

            {/* The actual staging */}
            <div className="mb-7">
              <Sub step="Stage" title="Stage the artist + a pair" hint="Re-run with the same email to add the 2nd pair." />
              <PreloadArtistForm homeHref="/editor" />
            </div>

            {/* What you've staged */}
            {stats && stats.staged.length > 0 && (
              <div className="mb-7">
                <Sub step="Yours" title="Pages you've set up" hint="Both pieces means it's done." />
                <div className="divide-y divide-[var(--d-line)] rounded-xl border border-[var(--d-line)]">
                  {stats.staged.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <Link href={`/artists/${s.slug}`} className="min-w-0 truncate font-medium text-[var(--d-ink)] hover:text-[var(--d-sage)]">
                        {s.displayName}
                      </Link>
                      <span className={`shrink-0 text-sm ${s.complete ? "text-[var(--d-sage)]" : "text-[var(--d-clay)]"}`}>
                        {s.complete ? `${s.pieces} pieces · all set` : `${s.pieces} of 2 · add the 2nd pair`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Office pipeline — pages waiting to be worked */}
            <div className="mb-7">
              <Sub step="Waiting" title="Pages to work" hint="Ones the office pre-loaded for outreach." />
              {outreachLeads.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--d-line)] bg-[var(--d-panel)] p-5 text-sm text-[var(--d-soft)]">
                  Nothing waiting right now — your pages and the office&apos;s will show up here.
                </p>
              ) : (
                <div className="space-y-3">
                  {outreachLeads.map((lead) => (
                    <OutreachRow key={lead.id} artistId={lead.id} displayName={lead.displayName}
                      defaultEmail={lead.user.email} invitedAgo={lead.invitedAt ? daysAgo(lead.invitedAt) : null}
                      pageSlug={lead.slug} stage={lead.outreachStage} notes={lead.outreachNotes} />
                  ))}
                </div>
              )}
            </div>

            {/* Hand a raw lead to the office */}
            <div>
              <Sub step="Handoff" title="Pass a lead to the office" hint="Not ready to stage? Log it for the office." />
              <StageProspectForm />
              {prospects.length > 0 && (
                <div className="mt-4 divide-y divide-[var(--d-line)] rounded-xl border border-[var(--d-line)]">
                  {prospects.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0 truncate">
                        <span className="font-medium text-[var(--d-ink)]">{p.name}</span>
                        {p.platform && <span className="text-[var(--d-soft)]"> · {p.platform}</span>}
                        {p.handle && <span className="text-[var(--d-soft)]"> · {p.handle}</span>}
                      </div>
                      <span className={`shrink-0 text-sm ${
                        p.status === "SENT" || p.status === "APPROVED" ? "text-[var(--d-sage)]" : "text-[var(--d-soft)]"
                      }`}>
                        {p.status === "STAGED" ? "in review" : p.status.toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          {/* 02 · Content */}
          <Panel id="content" index="02" title={editArticleRow ? "Edit article" : "Content"}
            count={articles.length} desc="Publish stories, swap cover photos, add new ones.">
            {editArticleRow && (
              <p className="mb-3 text-sm text-[var(--d-soft)]">
                Editing “{editArticleRow.title}” —{" "}
                <Link href="/editor" className="text-[var(--d-sage)] underline underline-offset-2">start a new one</Link>
              </p>
            )}
            <ArticleForm
              defaults={
                editArticleRow
                  ? {
                      id: editArticleRow.id, title: editArticleRow.title, slug: editArticleRow.slug,
                      excerpt: editArticleRow.excerpt, content: editArticleRow.content,
                      coverImage: editArticleRow.coverImage, tags: editArticleRow.tags, status: editArticleRow.status,
                      dropAt: editArticleRow.dropAt, raffleUrl: editArticleRow.raffleUrl, sku: editArticleRow.sku,
                      dropSource: editArticleRow.dropSource, dropCheckedAt: editArticleRow.dropCheckedAt,
                    }
                  : undefined
              }
            />
            {articles.length > 0 && (
              <div className="mt-4 divide-y divide-[var(--d-line)] rounded-xl border border-[var(--d-line)]">
                {articles.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 truncate">
                      <Link href={`/news/${a.slug}`} className="font-medium text-[var(--d-ink)] hover:text-[var(--d-sage)]">{a.title}</Link>{" "}
                      <span className={`text-xs ${a.status === "PUBLISHED" ? "text-[var(--d-sage)]" : "text-[var(--d-clay)]"}`}>
                        {a.status.toLowerCase()}
                      </span>
                    </div>
                    <Link href={`/editor?editArticle=${a.id}`}
                      className="shrink-0 rounded-lg border border-[var(--d-line)] px-3 py-1.5 text-sm text-[var(--d-ink)] transition hover:border-[var(--d-sage)]">
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* 03 · Share */}
          <Panel id="socials" index="03" title="Share it"
            desc="The site is home; socials point back to it. Post once, share everywhere.">
            <div className="mb-5">
              <FreeSocials fb={fb} ig={ig} />
            </div>
            <EditorBroadcastForm />
          </Panel>

          {/* 04 · Office */}
          <Panel id="office" index="04" title="The office" count={officeUnread}
            desc="Your private line to the admin — the only inbox you can reach.">
            <MessageOffice thread={threadView} />
          </Panel>
        </div>

        <p className="mt-10 text-center text-sm text-[var(--d-faint)]">
          Take your time. Good pages beat fast ones.
        </p>
      </div>
    </div>
  );
}
