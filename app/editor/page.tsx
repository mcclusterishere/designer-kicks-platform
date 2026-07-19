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
import CopyField from "./CopyField";

export const metadata = { title: "Editor Desk — The Heat Chart", robots: { index: false } };
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

// ---- Console building blocks (the distinct worker look) ----
function StatTile({ value, label, tone = "volt" }: { value: React.ReactNode; label: string; tone?: "volt" | "heat" | "plain" }) {
  const c = tone === "heat" ? "text-heat" : tone === "plain" ? "text-white" : "text-volt";
  return (
    <div className="rounded-lg border border-edge bg-surface px-3.5 py-3">
      <p className={`font-mono text-2xl leading-none ${c}`}>{value}</p>
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-smoke">{label}</p>
    </div>
  );
}

function Panel({
  id, index, title, count, countTone, desc, children,
}: {
  id: string; index: string; title: string;
  count?: number; countTone?: "heat" | "plain"; desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="overflow-hidden rounded-2xl border border-edge bg-surface shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-edge bg-panel/70 px-5 py-3">
          <span className="font-mono text-xs text-volt">{index}</span>
          <h2 className="display text-lg text-white">{title}</h2>
          {count != null && (
            <span className={`tag rounded-full border px-2 py-0.5 ${count && countTone === "heat" ? "border-heat/50 text-heat" : "border-edge text-smoke"}`}>
              {count}
            </span>
          )}
          {desc && <p className="ml-auto hidden max-w-md text-right text-xs text-smoke lg:block">{desc}</p>}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </section>
  );
}

// A sub-header inside a panel — keeps a busy section readable.
function Sub({ step, title, hint }: { step: string; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-volt">{step}</span>
      <h3 className="text-sm font-bold text-white">{title}</h3>
      {hint && <p className="text-xs text-smoke">{hint}</p>}
    </div>
  );
}

const NAV = [
  { id: "onboard", label: "Onboard" },
  { id: "content", label: "Content" },
  { id: "socials", label: "Socials" },
  { id: "office", label: "Office" },
];

// Which channels can go out for free right now, and how.
function FreeSocials({ fb, ig }: { fb: boolean; ig: boolean }) {
  const rows: Array<{ name: string; state: string; tone: "on" | "paste" | "off" }> = [
    { name: "The Feed (on-site)", state: "Live · one click", tone: "on" },
    { name: "Facebook Page", state: fb ? "Connected · one click" : "Office adds a token", tone: fb ? "on" : "off" },
    { name: "Instagram", state: ig ? "Connected · one click (needs a photo)" : "Office adds a token", tone: ig ? "on" : "off" },
    { name: "X / Twitter", state: "Free by copy-paste", tone: "paste" },
    { name: "TikTok", state: "Free by copy-paste", tone: "paste" },
    { name: "Threads / Reddit / anywhere", state: "Free by copy-paste", tone: "paste" },
  ];
  const dot = (t: "on" | "paste" | "off") =>
    t === "on" ? "bg-volt" : t === "paste" ? "bg-white/50" : "bg-smoke/40";
  return (
    <div className="rounded-xl border border-edge bg-panel/40 p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-smoke">Free to post right now</p>
      <ul className="mt-2 divide-y divide-edge/60">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="flex items-center gap-2 text-white">
              <span className={`h-1.5 w-1.5 rounded-full ${dot(r.tone)}`} />
              {r.name}
            </span>
            <span className="text-xs text-smoke">{r.state}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-smoke">
        Post once below — the site + any connected channels go out together, and you get
        paste-ready text for the rest. One-click channels are free via the office&apos;s Meta
        connection; the paste ones are free too, just manual.
      </p>
    </div>
  );
}

// The paid scoreboard — today's count vs quota, all-time, earnings, link.
function Scoreboard({ stats }: { stats: OnboardingStats }) {
  const pct = Math.min(100, Math.round((stats.doneToday / stats.quota) * 100));
  const earned = `$${(stats.earningsCents / 100).toFixed(2)}`;
  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-volt/30 bg-gradient-to-b from-volt/[0.06] to-transparent p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-volt">Today&apos;s pull</p>
          <p className="display mt-1 text-4xl leading-none text-white">
            {stats.doneToday}
            <span className="text-2xl text-smoke"> / {stats.quota}</span>
          </p>
        </div>
        <p className="text-xs text-smoke">
          {stats.doneToday >= stats.quota
            ? "Quota hit — that's the day. 🔥"
            : `${stats.quota - stats.doneToday} to go`}
          {stats.wipToday > 0 && ` · ${stats.wipToday} started, need a 2nd pair`}
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-edge">
        <div className="h-full rounded-full bg-volt transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile value={stats.totalDone} label="Onboarded · all-time" />
        <StatTile value={earned} label="Earned · $0.50 each" tone="plain" />
        <StatTile value={`${stats.quota}/day`} label="The target" tone="plain" />
      </div>
      {stats.refLink && (
        <div>
          <CopyField value={stats.refLink} label="Your tracked link — every visitor & artist from it is credited to you" />
        </div>
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
  const published = articles.filter((a) => a.status === "PUBLISHED").length;
  const fb = facebookConfigured();
  const ig = instagramConfigured();

  return (
    <div className="bg-ink">
      {/* Console bar — a distinct worker identity, not the public site */}
      <div className="border-b border-edge bg-panel/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-volt" />
            <span className="font-mono text-xs font-bold tracking-[0.25em] text-volt">THE&nbsp;DESK</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`}
                className="rounded px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-smoke transition hover:bg-white/5 hover:text-white">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-right">
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">{me?.name || me?.email || "Editor"}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-smoke">
                custom brand scout{admin ? " · admin" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Thin "powered on" accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-volt/40 to-transparent" />

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-volt">Custom brand scout</p>
            <h1 className="display mt-1 text-3xl text-white sm:text-4xl">
              {me?.name || me?.email || "Editor"}
            </h1>
          </div>
          {admin && !me && <span className="tag rounded-full border border-heat/50 px-3 py-1 text-heat">viewing as admin</span>}
        </div>

        {/* The paid scoreboard */}
        {stats ? (
          <Scoreboard stats={stats} />
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile value={published} label="Published" />
            <StatTile value={outreachLeads.length} label="To onboard" tone={outreachLeads.length ? "heat" : "volt"} />
            <StatTile value="—" label="Onboarded" tone="plain" />
            <StatTile value={officeUnread} label="From office" tone={officeUnread ? "heat" : "plain"} />
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* 01 · Onboard — the paid job, everything about bringing an artist in */}
          <Panel id="onboard" index="01" title="Onboard an artist" count={outreachLeads.length} countTone="heat"
            desc="Two pairs from one maker → an unclaimed page → cross-post. $0.50 each.">
            <div className="mb-5 rounded-xl border border-edge bg-panel/40 p-4 text-sm text-smoke">
              <p className="font-bold text-white">The play — one artist, one page, $0.50:</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Find a custom-shoe artist and <b className="text-white">2 pairs of their work</b>.</li>
                <li>Stage <b className="text-white">both pieces</b> below on one unclaimed profile — <b className="text-white">5–6 photos each</b>.</li>
                <li>Add the 2nd pair by staging again with the <b className="text-white">same artist email</b>.</li>
                <li>Cross-post the new page under <a href="#socials" className="text-volt underline">Socials</a>.</li>
              </ol>
              <p className="mt-2">A page counts (and pays) once it has both pieces. Target: <b className="text-white">20 a day</b>.</p>
            </div>

            {/* Optional: research a lead first */}
            <div className="mb-6">
              <Sub step="Optional" title="Research a lead first" hint="Turn a link into a drafted page." />
              <OnboardAgent />
            </div>

            {/* The actual staging */}
            <div className="mb-6">
              <Sub step="Stage" title="Stage the artist + a pair" hint="Re-run with the same email to add the 2nd pair." />
              <PreloadArtistForm homeHref="/editor" />
            </div>

            {/* What you've staged */}
            {stats && stats.staged.length > 0 && (
              <div className="mb-6">
                <Sub step="Yours" title="Pages you've staged" hint="Two pieces = complete = paid." />
                <div className="divide-y divide-edge/60 rounded-lg border border-edge">
                  {stats.staged.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <Link href={`/artists/${s.slug}`} className="min-w-0 truncate font-bold text-white hover:text-volt">
                        {s.displayName}
                      </Link>
                      <span className={`shrink-0 font-mono text-[10px] uppercase tracking-wider ${s.complete ? "text-volt" : "text-heat"}`}>
                        {s.complete ? `${s.pieces} pieces · complete` : `${s.pieces}/2 · add 2nd pair`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Office pipeline — pages waiting to be worked */}
            <div className="mb-6">
              <Sub step="Pipeline" title="Waiting to be worked" hint="Pages the office pre-loaded for outreach." />
              {outreachLeads.length === 0 ? (
                <p className="rounded-lg border border-dashed border-edge bg-panel/40 p-4 text-sm text-smoke">
                  Nobody waiting right now — your staged pages and the office&apos;s show up here.
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
              <Sub step="Handoff" title="Pass a lead to the office" hint="Not ready to stage? Log it for the office to send." />
              <StageProspectForm />
              {prospects.length > 0 && (
                <div className="mt-4 divide-y divide-edge/60 rounded-lg border border-edge">
                  {prospects.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0 truncate">
                        <span className="font-bold text-white">{p.name}</span>
                        {p.platform && <span className="text-smoke"> · {p.platform}</span>}
                        {p.handle && <span className="text-smoke"> · {p.handle}</span>}
                      </div>
                      <span className={`shrink-0 font-mono text-[10px] uppercase tracking-wider ${
                        p.status === "SENT" || p.status === "APPROVED" ? "text-volt" : p.status === "ARCHIVED" ? "text-smoke" : "text-heat"
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
              <p className="mb-3 text-xs text-smoke">
                Editing “{editArticleRow.title}” —{" "}
                <Link href="/editor" className="text-volt underline">start a new one</Link>
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
              <div className="mt-4 divide-y divide-edge/60 rounded-lg border border-edge">
                {articles.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0 truncate">
                      <Link href={`/news/${a.slug}`} className="font-bold text-white hover:text-volt">{a.title}</Link>{" "}
                      <span className={`font-mono text-[10px] uppercase tracking-wider ${a.status === "PUBLISHED" ? "text-volt" : "text-heat"}`}>
                        {a.status.toLowerCase()}
                      </span>
                    </div>
                    <Link href={`/editor?editArticle=${a.id}`}
                      className="shrink-0 rounded border border-edge px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white transition hover:border-volt">
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* 03 · Socials */}
          <Panel id="socials" index="03" title="Cross-post"
            desc="Site is the origin; the socials feed it. Post once, blast everywhere.">
            <div className="mb-5">
              <FreeSocials fb={fb} ig={ig} />
            </div>
            <EditorBroadcastForm />
          </Panel>

          {/* 04 · Office */}
          <Panel id="office" index="04" title="Message the office" count={officeUnread} countTone="heat"
            desc="Your private line to the admin — the only inbox you can reach.">
            <MessageOffice thread={threadView} />
          </Panel>
        </div>

        <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-wider text-smoke/50">
          Custom brand scout · onboard · content · cross-post — admin stays off-limits
        </p>
      </div>
    </div>
  );
}
