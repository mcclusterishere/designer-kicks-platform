import { prisma } from "@/lib/db";
import { isAdmin, adminAccountOk } from "@/lib/admin";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { finalizeExpiredOutfitBattles } from "@/lib/outfits";
import {
  adminLogout,
  setSubmissionStatus,
  endBattleNow,
  deleteProduct,
  deleteArticle,
  drawGiveawayWinner,
  toggleQuestion,
  deleteQuestion,
  forceAdvanceTournament,
  setArtistStatus,
  respondArtistClaim,
  setSaleVerified,
} from "@/app/actions";
import { formatUsd } from "@/lib/market";
import { getSiteAnalytics } from "@/lib/analytics";
import MiniBars from "@/components/MiniBars";
import LoginForm from "./LoginForm";
import CreateBattleForm from "./CreateBattleForm";
import ProductForm from "./ProductForm";
import ArticleForm from "./ArticleForm";
import GiveawayForm from "./GiveawayForm";
import { categoryEmoji } from "@/lib/categories";
import QuestionForm from "./QuestionForm";
import TournamentForm from "./TournamentForm";
import PreloadArtistForm from "./PreloadArtistForm";
import { HouseOutfitForm, OutfitBattleForm, OutreachRow } from "./OutfitStudioForms";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; editArticle?: string }>;
}) {
  if (!(await isAdmin())) {
    const accountOk = await adminAccountOk();
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="display text-4xl text-white">Admin</h1>
        {!accountOk && (
          <p className="mt-4 rounded-lg border border-heat/50 bg-heat/10 p-3 text-sm text-heat">
            This panel is locked to the owner&apos;s member account.{" "}
            <Link href="/signin" className="underline">Sign in to the site</Link>{" "}
            with that account first — then the password box below works.
          </p>
        )}
        <LoginForm />
      </div>
    );
  }

  await finalizeExpiredBattles();
  await finalizeExpiredOutfitBattles();
  const { edit, editArticle } = await searchParams;

  const [pending, approved, battles, products, editProduct, articles, editArticleRow] = await Promise.all([
    prisma.submission.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.submission.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.battle.findMany({
      orderBy: { createdAt: "desc" },
      include: { subA: true, subB: true, _count: { select: { votes: true } } },
      take: 20,
    }),
    prisma.product.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    edit ? prisma.product.findUnique({ where: { id: edit } }) : null,
    prisma.article.findMany({ orderBy: { createdAt: "desc" } }),
    editArticle ? prisma.article.findUnique({ where: { id: editArticle } }) : null,
  ]);

  const [giveaways, questions, users, tournaments] = await Promise.all([
    prisma.giveaway.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { entries: true } },
        winner: { select: { name: true, email: true } },
      },
    }),
    prisma.quizQuestion.findMany({ orderBy: [{ category: "asc" }, { difficulty: "asc" }] }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { votes: true, giveawayEntries: true } } },
    }),
    prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: { champion: true },
    }),
  ]);

  const pulse = await getSiteAnalytics();

  const artistApplications = await prisma.artistProfile.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true, createdAt: true } } },
  });

  // Profile claims: pending for review, plus recent approvals with their
  // live claim links so the DM can be re-sent manually.
  const profileClaims = await prisma.artistClaim.findMany({
    where: { status: { in: ["PENDING", "APPROVED"] } },
    orderBy: [{ status: "desc" }, { createdAt: "asc" }],
    take: 20,
    include: { artist: { select: { displayName: true, slug: true, userId: true } } },
  });
  const approvedClaimLinks = new Map();
  for (const c of profileClaims.filter((c) => c.status === "APPROVED")) {
    const u = await prisma.user.findUnique({ where: { email: c.email } });
    if (!u) continue;
    const tok = await prisma.passwordResetToken.findFirst({
      where: { userId: u.id, expires: { gt: new Date() } },
    });
    if (tok) approvedClaimLinks.set(c.id, `/reset-password/${tok.token}`);
  }

  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      submission: { select: { title: true } },
      seller: { select: { name: true, email: true } },
      buyer: { select: { name: true } },
    },
  });

  // Outfit Studio: heat ranks per piece so the top of each category is
  // obvious while assembling a house fit, plus the pool of built fits.
  const heatRank = new Map((await getHeatList()).map((e, i) => [e.id, i + 1]));
  const [outfits, outfitBattles] = await Promise.all([
    prisma.outfit.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { items: true } },
        owner: { select: { name: true } },
      },
    }),
    prisma.outfitBattle.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        outfitA: { select: { name: true } },
        outfitB: { select: { name: true } },
        _count: { select: { votes: true } },
      },
    }),
  ]);
  const categoryLeaders = ["sneakers", "apparel", "accessories"].map((cat) => ({
    category: cat,
    top: approved
      .filter((s) => s.category === cat)
      .sort((a, b) => (heatRank.get(a.id) ?? 9999) - (heatRank.get(b.id) ?? 9999))
      .slice(0, 3),
  }));

  // Outreach: approved pages whose account has never been claimed — no
  // password and no OAuth link means the artist has never logged in.
  const outreachLeads = await prisma.artistProfile.findMany({
    where: {
      status: "APPROVED",
      user: { passwordHash: null, accounts: { none: {} } },
    },
    orderBy: [{ invitedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    include: { user: { select: { email: true } } },
  });
  const humanizeAgo = (d: Date) => {
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="display text-4xl text-white">Admin</h1>
        <form action={adminLogout}>
          <button className="tag text-smoke hover:text-white">Log out</button>
        </form>
      </div>

      {/* Pending submissions */}
      <section className="mt-10">
        <h2 className="display text-2xl text-white">
          Review Queue{" "}
          <span className={pending.length ? "text-heat" : "text-smoke"}>
            ({pending.length})
          </span>
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-smoke">Queue is clear.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((s) => (
              <div key={s.id} className="overflow-hidden rounded-xl border border-edge bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.imageUrl} alt={s.title} className="aspect-square w-full object-cover" />
                <div className="p-3">
                  <p className="font-bold text-white">{s.title}</p>
                  <p className="text-sm text-smoke">
                    {categoryEmoji(s.category)} {s.baseShoe} · {s.artistName}
                    {s.socialHandle && ` · @${s.socialHandle}`}
                  </p>
                  <p className="text-xs text-smoke">{s.email}</p>
                  {s.description && (
                    <p className="mt-1 line-clamp-3 text-xs text-smoke">{s.description}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <form action={setSubmissionStatus.bind(null, s.id, "APPROVED")} className="flex-1">
                      <button className="w-full rounded bg-volt py-2 tag font-bold text-ink">
                        Approve
                      </button>
                    </form>
                    <form action={setSubmissionStatus.bind(null, s.id, "REJECTED")} className="flex-1">
                      <button className="w-full rounded border border-heat py-2 tag text-heat">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pre-load artist (onboarding accelerator) */}
      <section className="mt-12 rounded-xl border border-volt/40 bg-panel p-5">
        <h2 className="display text-2xl text-white">
          Site <span className="text-gradient-volt">Pulse</span>
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Members", value: `${pulse.tiles.members} (+${pulse.tiles.members7} this wk)` },
            { label: "Votes", value: `${pulse.tiles.votes} (+${pulse.tiles.votes7} this wk)` },
            { label: "Quiz runs this wk", value: pulse.tiles.quizRuns7 },
            { label: "Giveaway entries", value: pulse.tiles.entries },
            { label: "Sales volume", value: `${formatUsd(pulse.tiles.salesVolumeCents)} (${pulse.tiles.salesCount})` },
            { label: "Open offers", value: pulse.tiles.openOffers },
            { label: "Live battles", value: pulse.tiles.activeBattles },
            { label: "Artists in league", value: pulse.tiles.approvedArtists },
            {
              label: "Design ratings",
              value: `${pulse.ratingsPulse.ratingsTotal} (+${pulse.ratingsPulse.ratings7} this wk)`,
            },
            {
              label: "Avg heat score",
              value: pulse.ratingsPulse.avgStars !== null ? `${pulse.ratingsPulse.avgStars} / 5` : "—",
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-edge bg-surface p-3 text-center">
              <p className="display text-lg text-volt">{s.value}</p>
              <p className="tag mt-1 text-smoke">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-edge bg-surface p-4">
            <p className="tag text-smoke">Votes — last 14 days</p>
            <div className="mt-2"><MiniBars series={pulse.votesSeries} /></div>
          </div>
          <div className="rounded-xl border border-edge bg-surface p-4">
            <p className="tag text-smoke">Signups — last 14 days</p>
            <div className="mt-2"><MiniBars series={pulse.signupsSeries} accent="heat" /></div>
          </div>
        </div>
        {pulse.topPieces.length > 0 && (
          <div className="mt-4 rounded-xl border border-edge bg-surface p-4">
            <p className="tag text-smoke">Most-voted pieces</p>
            <ol className="mt-2 space-y-1 text-sm">
              {pulse.topPieces.map((tp, i) => (
                <li key={tp.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-white">
                    {i + 1}. {tp.title} <span className="text-smoke">— {tp.artistName}</span>
                  </span>
                  <span className="shrink-0 text-volt">{tp.votes} votes</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Taste Pulse: the taxonomy under every vote and rating */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { title: "Brand Heat", rows: pulse.brandHeat },
            { title: "Silhouette Heat", rows: pulse.silhouetteHeat },
          ].map((board) => (
            <div key={board.title} className="rounded-xl border border-edge bg-surface p-4">
              <p className="tag text-smoke">{board.title} — votes + ratings</p>
              {board.rows.length === 0 ? (
                <p className="mt-2 text-sm text-smoke">No taxonomy data yet.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {board.rows.map((r) => {
                    const max = board.rows[0].total || 1;
                    return (
                      <div key={r.name}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-white">{r.name}</span>
                          <span className="tabular text-xs text-volt">
                            {r.votes}v · {r.ratings}r
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-panel">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-volt to-heat"
                            style={{ width: `${Math.round((r.total / max) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        {pulse.topRated.length > 0 && (
          <div className="mt-4 rounded-xl border border-edge bg-surface p-4">
            <p className="tag text-smoke">Top rated in the Rate game</p>
            <ol className="mt-2 space-y-1 text-sm">
              {pulse.topRated.map((tr, i) => (
                <li key={tr.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-white">
                    {i + 1}. {tr.title} <span className="text-smoke">— {tr.artistName}</span>
                  </span>
                  <span className="shrink-0 text-volt">
                    {tr.avg} 🔥 ({tr.count})
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="display text-2xl text-white">Pre-load An Artist</h2>
        <p className="mt-1 text-sm text-smoke">
          Create an artist&apos;s page and first piece on their behalf (with
          permission). You get a 14-day claim link and a ready-to-send DM —
          and the invite emails itself when Resend is configured.
        </p>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <PreloadArtistForm />
        </div>
      </section>

      {/* Outreach: cold leads with pre-loaded pages who never claimed */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">
          Outreach{" "}
          <span className={outreachLeads.length ? "text-heat" : "text-smoke"}>
            ({outreachLeads.length} unclaimed)
          </span>
        </h2>
        <p className="mt-1 text-sm text-smoke">
          Every pre-loaded page still waiting on its artist. Drop in their
          real email and Send Invite — they get the pitch (page live, 1%
          vs 10% fees, keep every sale) plus their personal claim link. No
          Resend key set? You get the claim link to DM by hand instead.
        </p>
        {outreachLeads.length === 0 ? (
          <p className="mt-3 text-sm text-smoke">
            No cold leads — every artist page on the chart is claimed. 🔥
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {outreachLeads.map((lead) => (
              <OutreachRow
                key={lead.id}
                artistId={lead.id}
                displayName={lead.displayName}
                defaultEmail={lead.user.email}
                invitedAgo={lead.invitedAt ? humanizeAgo(lead.invitedAt) : null}
                pageSlug={lead.slug}
              />
            ))}
          </div>
        )}
      </section>

      {/* Artist applications */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">
          Profile Claims{" "}
          <span className={profileClaims.some((c) => c.status === "PENDING") ? "text-heat" : "text-smoke"}>
            ({profileClaims.filter((c) => c.status === "PENDING").length})
          </span>
        </h2>
        <p className="mt-1 text-sm text-smoke">
          Artists asserting ownership of pre-loaded pages. Approving relinks
          the page to their email and sends the password link.
        </p>
        {profileClaims.length === 0 ? (
          <p className="mt-3 text-sm text-smoke">No claims yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {profileClaims.map((c) => (
              <div key={c.id} className="rounded-xl border border-edge bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white">
                      {c.artist.displayName}
                      {c.status === "APPROVED" && <span className="tag text-volt"> · approved ✓</span>}
                    </p>
                    <p className="text-sm text-smoke">
                      {c.name} · {c.email}
                    </p>
                    <p className="text-sm text-volt">Proof: {c.socialProof}</p>
                    {c.message && <p className="mt-1 text-sm text-smoke">{c.message}</p>}
                    {c.status === "APPROVED" && approvedClaimLinks.has(c.id) && (
                      <p className="mt-1 break-all font-mono text-xs text-volt">
                        Claim link: {approvedClaimLinks.get(c.id)}
                      </p>
                    )}
                  </div>
                  {c.status === "PENDING" && (
                    <div className="flex shrink-0 gap-2">
                      <form action={respondArtistClaim.bind(null, c.id, true)}>
                        <button className="rounded bg-volt px-4 py-2 tag font-bold text-ink">
                          Verify &amp; Hand Over
                        </button>
                      </form>
                      <form action={respondArtistClaim.bind(null, c.id, false)}>
                        <button className="rounded border border-heat px-4 py-2 tag text-heat">
                          Reject
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 rounded-xl border border-edge bg-panel p-5">
        <h2 className="display text-2xl text-white">
          Artist Applications{" "}
          <span className={artistApplications.length ? "text-heat" : "text-smoke"}>
            ({artistApplications.length})
          </span>
        </h2>
        {artistApplications.length === 0 ? (
          <p className="mt-3 text-sm text-smoke">No pending applications.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {artistApplications.map((a) => (
              <div key={a.id} className="rounded-xl border border-edge bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white">{a.displayName}</p>
                    <p className="text-sm text-smoke">
                      {a.user.name} · {a.user.email}
                      {a.instagram && <span className="text-volt"> · @{a.instagram}</span>}
                      {a.city && ` · ${a.city}`}
                    </p>
                    {a.portfolioUrl && (
                      <a
                        href={a.portfolioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-volt underline"
                      >
                        {a.portfolioUrl}
                      </a>
                    )}
                    {a.bio && <p className="mt-1 text-sm text-smoke">{a.bio}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={setArtistStatus.bind(null, a.id, "APPROVED")}>
                      <button className="rounded bg-volt px-4 py-2 tag font-bold text-ink">
                        Approve
                      </button>
                    </form>
                    <form action={setArtistStatus.bind(null, a.id, "REJECTED")}>
                      <button className="rounded border border-heat px-4 py-2 tag text-heat">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create battle */}
      <section className="mt-12 rounded-xl border border-edge bg-surface p-5">
        <h2 className="display text-2xl text-white">Start A Battle</h2>
        <div className="mt-4">
          <CreateBattleForm
            options={approved.map((s) => ({
              id: s.id,
              title: s.title,
              artistName: s.artistName,
            }))}
          />
        </div>
      </section>

      {/* Battles */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">Battles</h2>
        <div className="mt-4 space-y-2">
          {battles.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
            >
              <div>
                <Link href={`/battles/${b.id}`} className="font-bold text-white hover:text-volt">
                  {b.subA.title} vs {b.subB.title}
                </Link>
                <p className="text-xs text-smoke">
                  {b.status} · {b._count.votes} votes · ends{" "}
                  {b.endsAt.toISOString().slice(0, 10)}
                  {b.winnerId && ` · winner: ${b.winnerId === b.subAId ? b.subA.title : b.subB.title}`}
                </p>
              </div>
              {b.status === "ACTIVE" && (
                <form action={endBattleNow.bind(null, b.id)}>
                  <button className="rounded border border-heat px-3 py-1.5 tag text-heat">
                    End now
                  </button>
                </form>
              )}
            </div>
          ))}
          {battles.length === 0 && <p className="text-sm text-smoke">No battles yet.</p>}
        </div>
      </section>

      {/* Outfit Studio: assemble house fits, match fit battles */}
      <section className="mt-12 rounded-xl border border-volt/40 bg-panel p-5">
        <h2 className="display text-2xl text-white">
          Outfit <span className="text-gradient-volt">Studio</span>
        </h2>
        <p className="mt-1 text-sm text-smoke">
          Style the chart&apos;s best pieces into full looks and put fit
          against fit. Category leaders below are ranked straight off the
          Heat List — pair the winners with looks that go together.
        </p>

        {/* Category leaders: the top three of each clothing type */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {categoryLeaders.map((g) => (
            <div key={g.category} className="rounded-lg border border-edge bg-surface p-3">
              <p className="tag text-volt">
                {categoryEmoji(g.category)} Top {g.category}
              </p>
              {g.top.length === 0 ? (
                <p className="mt-2 text-xs text-smoke">Nothing approved yet.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {g.top.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm text-smoke">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.imageUrl} alt={s.title} className="h-8 w-8 rounded object-cover" />
                      <span className="min-w-0 truncate">
                        <span className="text-volt">#{heatRank.get(s.id) ?? "—"}</span>{" "}
                        <span className="text-white">{s.title}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <h3 className="tag mt-6 text-white">1 · Build a house fit</h3>
        <div className="mt-2">
          <HouseOutfitForm
            pieces={approved.map((s) => ({
              id: s.id,
              title: s.title,
              category: s.category,
              artistName: s.artistName,
              rank: heatRank.get(s.id) ?? null,
            }))}
          />
        </div>

        <h3 className="tag mt-6 text-white">2 · Match a fit battle</h3>
        <p className="mt-1 text-xs text-smoke">
          House vs house, fan vs fan, or crossover — fan fits come in from
          members&apos; closets on their profile page.
        </p>
        <div className="mt-2">
          {outfits.length < 2 ? (
            <p className="text-sm text-smoke">
              Need at least two fits in the pool ({outfits.length} so far).
            </p>
          ) : (
            <OutfitBattleForm
              outfits={outfits.map((o) => ({
                id: o.id,
                name: o.kind === "FAN" && o.owner?.name ? `${o.name} — ${o.owner.name}` : o.name,
                kind: o.kind,
                itemCount: o._count.items,
              }))}
            />
          )}
        </div>

        {outfitBattles.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="tag text-white">Fit battles</h3>
            {outfitBattles.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
              >
                <div>
                  <Link href="/outfits" className="font-bold text-white hover:text-volt">
                    {b.outfitA.name} vs {b.outfitB.name}
                  </Link>
                  <p className="text-xs text-smoke">
                    {b.league} league · {b.status} · {b._count.votes} votes · ends{" "}
                    {b.endsAt.toISOString().slice(0, 10)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tournaments */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">Tournaments</h2>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <p className="tag text-heat">Launch a bracket</p>
          <div className="mt-3">
            <TournamentForm
              options={approved.map((s) => ({
                id: s.id,
                title: s.title,
                artistName: s.artistName,
              }))}
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {tournaments.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
            >
              <div>
                <Link href={`/tournaments/${t.slug}`} className="font-bold text-white hover:text-volt">
                  {t.name}
                </Link>{" "}
                <span className={t.status === "ACTIVE" ? "text-heat" : "text-smoke"}>
                  · {t.status.toLowerCase()} · {t.size} customs
                </span>
                {t.champion && (
                  <p className="text-xs text-smoke">🏆 {t.champion.title} by {t.champion.artistName}</p>
                )}
              </div>
              {t.status === "ACTIVE" && (
                <form action={forceAdvanceTournament.bind(null, t.id)}>
                  <button className="rounded border border-heat px-3 py-1.5 tag text-heat">
                    End round now
                  </button>
                </form>
              )}
            </div>
          ))}
          {tournaments.length === 0 && <p className="text-sm text-smoke">No tournaments yet.</p>}
        </div>
      </section>

      {/* Giveaways */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">Giveaways</h2>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <p className="tag text-heat">Launch a giveaway</p>
          <div className="mt-3">
            <GiveawayForm />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {giveaways.map((g) => (
            <div
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
            >
              <div>
                <span className="font-bold text-white">{g.prize}</span>{" "}
                <span className={g.status === "ACTIVE" ? "text-volt" : "text-smoke"}>
                  · {g.status.toLowerCase()}
                </span>
                <p className="text-xs text-smoke">
                  {g._count.entries} entries · ends {g.endsAt.toISOString().slice(0, 10)}
                  {g.winner && ` · winner: ${g.winner.name} (${g.winner.email})`}
                </p>
              </div>
              {g.status === "ACTIVE" && (
                <form action={drawGiveawayWinner.bind(null, g.id)}>
                  <button className="rounded border border-heat px-3 py-1.5 tag text-heat">
                    Draw winner now
                  </button>
                </form>
              )}
            </div>
          ))}
          {giveaways.length === 0 && <p className="text-sm text-smoke">No giveaways yet.</p>}
        </div>
      </section>

      {/* Quiz questions */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">
          Quiz Questions{" "}
          <span className="text-smoke">
            ({questions.filter((q) => q.active).length} active / {questions.length})
          </span>
        </h2>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <p className="tag text-volt">Add a question</p>
          <div className="mt-3">
            <QuestionForm />
          </div>
        </div>
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
          {questions.map((q) => (
            <div
              key={q.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm ${
                q.active ? "" : "opacity-50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-white">{q.question}</p>
                <p className="text-xs text-smoke">
                  {q.category} · difficulty {q.difficulty} ·{" "}
                  answer: {(JSON.parse(q.options) as string[])[q.answerIndex]}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={toggleQuestion.bind(null, q.id)}>
                  <button className="rounded border border-edge px-3 py-1.5 tag text-white hover:border-volt">
                    {q.active ? "Disable" : "Enable"}
                  </button>
                </form>
                <form action={deleteQuestion.bind(null, q.id)}>
                  <button className="rounded border border-heat px-3 py-1.5 tag text-heat">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
          {questions.length === 0 && (
            <p className="text-sm text-smoke">No questions yet — run the seed or add some above.</p>
          )}
        </div>
      </section>

      {/* Users */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl text-white">
            Members <span className="text-smoke">({users.length}{users.length === 50 ? "+" : ""})</span>
          </h2>
          <a
            href="/api/admin/users.csv"
            className="rounded-lg border border-volt px-4 py-2 tag text-volt hover:bg-volt hover:text-ink"
          >
            Export CSV
          </a>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel">
              <tr>
                {["Name", "Email", "Phone", "City", "Size", "IG", "Opt-in", "Votes", "Entries"].map((h) => (
                  <th key={h} className="px-3 py-2 tag text-smoke">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-edge">
                  <td className="px-3 py-2 text-white">{u.name}</td>
                  <td className="px-3 py-2 text-smoke">{u.email}</td>
                  <td className="px-3 py-2 text-smoke">{u.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-smoke">{u.city ?? "—"}</td>
                  <td className="px-3 py-2 text-smoke">{u.shoeSize ?? "—"}</td>
                  <td className="px-3 py-2 text-smoke">{u.instagram ? `@${u.instagram}` : "—"}</td>
                  <td className="px-3 py-2">{u.marketingOptIn ? "✅" : "—"}</td>
                  <td className="px-3 py-2 text-smoke">{u._count.votes}</td>
                  <td className="px-3 py-2 text-smoke">{u._count.giveawayEntries}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-smoke">
                    No members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sales ledger */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">
          Sales Ledger <span className="text-smoke">({sales.length})</span>
        </h2>
        <p className="mt-1 text-sm text-smoke">
          Off-platform sales recorded by sellers. ✓ verification requires
          evidence + buyer claim — or your override here.
        </p>
        <div className="mt-4 space-y-2">
          {sales.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <span className="font-bold text-white">{s.submission.title}</span>{" "}
                <span className="text-white">{formatUsd(s.priceCents)}</span>{" "}
                <span className={s.status === "PENDING" ? "text-heat" : "text-volt"}>
                  · {s.status === "PENDING" ? "pending claim" : "confirmed"}
                </span>
                {s.verified ? (
                  <span className="text-volt"> · ✓ verified ({s.verifiedBy})</span>
                ) : (
                  <span className="text-smoke"> · unverified</span>
                )}
                <p className="text-xs text-smoke">
                  {s.seller.name ?? s.seller.email} → {s.buyer?.name ?? s.buyerEmail} ·{" "}
                  {s.soldAt.toISOString().slice(0, 10)}
                  {s.evidenceUrl && (
                    <>
                      {" · "}
                      <a href={s.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-volt underline">
                        view evidence
                      </a>
                    </>
                  )}
                </p>
              </div>
              <form action={setSaleVerified.bind(null, s.id, !s.verified)}>
                <button
                  className={`rounded border px-3 py-1.5 tag ${
                    s.verified ? "border-heat text-heat" : "border-volt text-volt"
                  }`}
                >
                  {s.verified ? "Remove ✓" : "Verify ✓"}
                </button>
              </form>
            </div>
          ))}
          {sales.length === 0 && <p className="text-sm text-smoke">No sales recorded yet.</p>}
        </div>
      </section>

      {/* Newsroom */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">
          Newsroom <span className="text-smoke">({articles.length})</span>
        </h2>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <p className="tag text-volt">{editArticleRow ? "Edit article" : "Write article"}</p>
          {editArticleRow && (
            <p className="mt-1 text-xs text-smoke">
              Editing “{editArticleRow.title}” —{" "}
              <Link href="/admin" className="text-volt underline">cancel</Link>
            </p>
          )}
          <div className="mt-3">
            <ArticleForm
              defaults={
                editArticleRow
                  ? {
                      id: editArticleRow.id,
                      title: editArticleRow.title,
                      slug: editArticleRow.slug,
                      excerpt: editArticleRow.excerpt,
                      content: editArticleRow.content,
                      coverImage: editArticleRow.coverImage,
                      tags: editArticleRow.tags,
                      status: editArticleRow.status,
                    }
                  : undefined
              }
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {articles.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/news/${a.slug}`}
                  className="font-bold text-white hover:text-volt"
                >
                  {a.title}
                </Link>{" "}
                <span className={a.status === "PUBLISHED" ? "text-volt" : "text-heat"}>
                  · {a.status.toLowerCase()}
                </span>
                <p className="truncate text-xs text-smoke">/news/{a.slug}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/admin?editArticle=${a.id}`}
                  className="rounded border border-edge px-3 py-1.5 tag text-white hover:border-volt"
                >
                  Edit
                </Link>
                <form action={deleteArticle.bind(null, a.id)}>
                  <button className="rounded border border-heat px-3 py-1.5 tag text-heat">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
          {articles.length === 0 && <p className="text-sm text-smoke">No articles yet.</p>}
        </div>
      </section>

      {/* Products */}
      <section className="mt-12">
        <h2 className="display text-2xl text-white">
          Shop Products <span className="text-smoke">({products.length})</span>
        </h2>
        <div className="mt-4 rounded-xl border border-edge bg-surface p-5">
          <p className="tag text-volt">{editProduct ? "Edit product" : "Add product"}</p>
          {editProduct && (
            <p className="mt-1 text-xs text-smoke">
              Editing “{editProduct.name}” —{" "}
              <Link href="/admin" className="text-volt underline">cancel</Link>
            </p>
          )}
          <div className="mt-3">
            <ProductForm
              defaults={
                editProduct
                  ? {
                      id: editProduct.id,
                      name: editProduct.name,
                      merchant: editProduct.merchant,
                      category: editProduct.category,
                      blurb: editProduct.blurb,
                      price: editProduct.price,
                      imageUrl: editProduct.imageUrl,
                      affiliateUrl: editProduct.affiliateUrl,
                      featured: editProduct.featured,
                    }
                  : undefined
              }
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <span className="font-bold text-white">{p.name}</span>{" "}
                <span className="text-smoke">
                  · {p.merchant} · {p.category}
                  {p.featured && " · ⭐ featured"}
                </span>
                <p className="truncate text-xs text-smoke">{p.affiliateUrl}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/admin?edit=${p.id}`}
                  className="rounded border border-edge px-3 py-1.5 tag text-white hover:border-volt"
                >
                  Edit
                </Link>
                <form action={deleteProduct.bind(null, p.id)}>
                  <button className="rounded border border-heat px-3 py-1.5 tag text-heat">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
