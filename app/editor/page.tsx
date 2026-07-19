import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUserRole } from "@/lib/editor";
import { isAdmin } from "@/lib/admin";
import ArticleForm from "@/app/admin/ArticleForm";
import { OutreachRow } from "@/app/admin/OutfitStudioForms";
import EditorBroadcastForm from "./EditorBroadcastForm";
import StageProspectForm from "./StageProspectForm";
import MessageOffice from "./MessageOffice";

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

const NAV = [
  { id: "content", label: "Content" },
  { id: "crosspost", label: "Cross-post" },
  { id: "stage", label: "Stage" },
  { id: "onboard", label: "Onboard" },
  { id: "office", label: "Office" },
];

export default async function EditorDesk({
  searchParams,
}: {
  searchParams: Promise<{ editArticle?: string }>;
}) {
  const [me, admin] = await Promise.all([currentUserRole(), isAdmin()]);
  if (!(me?.role === "EDITOR" || admin)) redirect(me ? "/" : "/signin");

  const { editArticle } = await searchParams;
  const [articles, editArticleRow, prospects, thread, outreachLeads] = await Promise.all([
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
  ]);
  const daysAgo = (d: Date) => {
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  };

  const threadView = thread.map((m) => ({ id: m.id, body: m.body, fromAdmin: m.fromAdmin, ago: ago(m.createdAt) }));
  const officeUnread = thread.filter((m) => m.fromAdmin && !m.readByEditor).length;
  const published = articles.filter((a) => a.status === "PUBLISHED").length;
  const openStaged = prospects.filter((p) => p.status === "STAGED" || p.status === "APPROVED").length;

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
                editor{admin ? " · admin" : ""}
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
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-volt">Editor workstation</p>
            <h1 className="display mt-1 text-3xl text-white sm:text-4xl">
              {me?.name || me?.email || "Editor"}
            </h1>
          </div>
          {admin && !me && <span className="tag rounded-full border border-heat/50 px-3 py-1 text-heat">viewing as admin</span>}
        </div>

        {/* At-a-glance strip */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile value={published} label="Published" />
          <StatTile value={outreachLeads.length} label="To onboard" tone={outreachLeads.length ? "heat" : "volt"} />
          <StatTile value={openStaged} label="Staged" tone="plain" />
          <StatTile value={officeUnread} label="From office" tone={officeUnread ? "heat" : "plain"} />
        </div>

        <div className="mt-8 space-y-6">
          {/* 01 · Content */}
          <Panel id="content" index="01" title={editArticleRow ? "Edit article" : "Content"}
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

          {/* 02 · Cross-post */}
          <Panel id="crosspost" index="02" title="Cross-post"
            desc="Site is the origin; the connected socials are feeders.">
            <EditorBroadcastForm />
          </Panel>

          {/* 03 · Stage outreach */}
          <Panel id="stage" index="03" title="Stage outreach" count={openStaged}
            desc="Line up prospects for the office to review and send.">
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
          </Panel>

          {/* 04 · Onboarding pipeline */}
          <Panel id="onboard" index="04" title="Onboarding pipeline" count={outreachLeads.length} countTone="heat"
            desc="Unclaimed pages to reach — these are your onboardings.">
            {outreachLeads.length === 0 ? (
              <p className="rounded-lg border border-dashed border-edge bg-panel/40 p-5 text-sm text-smoke">
                Nobody waiting right now — new pages the office pre-loads show up here.
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
          </Panel>

          {/* 05 · Office */}
          <Panel id="office" index="05" title="Message the office" count={officeUnread} countTone="heat"
            desc="Your private line to the admin — the only inbox you can reach.">
            <MessageOffice thread={threadView} />
          </Panel>
        </div>

        <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-wider text-smoke/50">
          Editor scope · content · cross-post · outreach — admin stays off-limits
        </p>
      </div>
    </div>
  );
}
