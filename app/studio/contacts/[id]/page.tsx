import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isPro } from "@/lib/plans";
import { timeline, contactTaste, contactPortfolio, sizeMatches } from "@/lib/crm";
import { completeTaskAction } from "@/app/actions";
import ActivityForm from "./ActivityForm";
import TaskForm from "./TaskForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contact — The Heat Chart Studio" };

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function when(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const KIND_MARK: Record<string, string> = {
  NOTE: "✎", CALL: "☎", EMAIL: "✉", DM: "💬", MEETING: "◉",
  SALE: "$", OFFER: "▲", CLAIM: "✓", IMPORT: "⇥",
};

/**
 * The contact record.
 *
 * This is the page that decides whether the software feels like a CRM or
 * like a spreadsheet with a nicer font. A list of names tells you who
 * exists; this tells you what the relationship is — what they bought,
 * what it's worth now, what they're into, what was said, and what you
 * promised to do next.
 *
 * The right-hand column is the part no other CRM can render, because it
 * is made of facts only this platform has: what they hold, what it's
 * worth today, and what they vote for.
 */
export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?next=/studio/contacts/${id}`);

  const artist = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true, plan: true, planStatus: true, paidThrough: true },
  });
  if (!artist || artist.status !== "APPROVED") redirect("/submit");
  if (!isPro(artist)) redirect("/studio/contacts");

  // Scoped by artistId, always. A contact id in a URL is attacker input,
  // and a customer list is the one thing that must never cross accounts.
  const contact = await prisma.contact.findFirst({
    where: { id, artistId: artist.id },
    include: { tasks: { where: { doneAt: null }, orderBy: { dueAt: "asc" } } },
  });
  if (!contact) notFound();

  const [events, taste, folio, sameSize] = await Promise.all([
    timeline(contact.id),
    contactTaste(contact.userId),
    contactPortfolio(contact.userId, artist.id),
    contact.shoeSize ? sizeMatches(artist.id, contact.shoeSize) : Promise.resolve([]),
  ]);

  const custom = (contact.customFields as Record<string, string> | null) ?? {};

  // Overdue is resolved here, alongside the other awaited data, rather
  // than read off the clock inside the JSX — a render must not depend on
  // Date.now(), and the lint rule is right to say so.
  const tasks = contact.tasks.map((t) => ({ ...t, overdue: t.dueAt < new Date() }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/studio/contacts" className="tag text-smoke underline hover:text-white">
        ← All contacts
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="display text-4xl text-white">{contact.name}</h1>
          <p className="mt-1 text-sm text-smoke">
            {[contact.email, contact.phone, contact.social ? `@${contact.social}` : null, contact.city]
              .filter(Boolean)
              .join(" · ") || "No contact details yet"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {contact.purchaseCount > 1 && (
              <span className="rounded-full border border-volt/50 px-2 py-0.5 tag text-volt">repeat buyer</span>
            )}
            {contact.shoeSize && (
              <span className="rounded-full border border-edge px-2 py-0.5 tag text-smoke">
                size {contact.shoeSize}
              </span>
            )}
            {contact.tags.map((t) => (
              <span key={t} className="rounded-full border border-edge px-2 py-0.5 tag text-smoke">
                {t}
              </span>
            ))}
            {contact.importSource && (
              <span className="rounded-full border border-edge px-2 py-0.5 tag text-smoke">
                from {contact.importSource}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-edge bg-panel px-4 py-2.5 text-right">
          <p className="tag text-smoke">Lifetime</p>
          <p className="display text-2xl tabular-nums text-volt">{usd(contact.totalSpentCents)}</p>
          <p className="text-[11px] text-smoke">
            {contact.purchaseCount} {contact.purchaseCount === 1 ? "purchase" : "purchases"}
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* The story */}
        <div>
          <section className="rounded-xl border border-edge bg-surface p-5">
            <h2 className="display text-xl text-white">Log what happened</h2>
            <div className="mt-3">
              <ActivityForm contactId={contact.id} />
            </div>
          </section>

          {contact.tasks.length > 0 && (
            <section className="mt-5 rounded-xl border border-heat/40 bg-surface p-5">
              <h2 className="display text-xl text-heat">Follow-ups</h2>
              <ul className="mt-2 space-y-1.5">
                {tasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className={t.overdue ? "text-heat" : "text-white"}>
                        {t.title}{" "}
                        <span className="text-smoke">
                          · {t.overdue ? "overdue " : "due "}
                          {when(t.dueAt)}
                        </span>
                      </span>
                      <form action={completeTaskAction}>
                        <input type="hidden" name="taskId" value={t.id} />
                        <button className="tag shrink-0 rounded border border-edge px-2 py-1 text-smoke transition hover:border-volt hover:text-white">
                          Done
                        </button>
                      </form>
                    </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-5 rounded-xl border border-edge bg-surface p-5">
            <h2 className="display text-xl text-white">Set a follow-up</h2>
            <div className="mt-3">
              <TaskForm contactId={contact.id} />
            </div>
          </section>

          <section className="mt-5">
            <h2 className="display text-xl text-white">Timeline</h2>
            {events.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-edge bg-surface p-6 text-center text-sm text-smoke">
                Nothing logged yet. Anything you record above shows up here, and sales and claims
                land automatically.
              </p>
            ) : (
              <ol className="mt-3 space-y-0">
                {events.map((e, i) => (
                  <li key={e.id} className="relative flex gap-3 pb-4">
                    {/* The spine, stopping at the last entry rather than
                        dangling past it. */}
                    {i < events.length - 1 && (
                      <span aria-hidden className="absolute left-[13px] top-7 h-full w-px bg-edge" />
                    )}
                    <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-edge bg-panel text-xs text-volt">
                      {KIND_MARK[e.kind] ?? "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{e.body}</p>
                      <p className="mt-0.5 tag text-smoke">
                        {e.kind.toLowerCase()} · {when(e.occurredAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* What only this CRM knows */}
        <div className="space-y-5">
          {folio.pieces.length > 0 && (
            <section className="rounded-xl border border-volt/40 bg-surface p-5">
              <h2 className="display text-xl text-white">What they&apos;re holding</h2>
              <p className="mt-1 text-xs text-smoke">
                Paid {usd(folio.paidCents)} · worth {usd(folio.valueCents)} today{" "}
                {folio.changePct !== 0 && (
                  <span className={folio.changePct > 0 ? "text-volt" : "text-heat"}>
                    ({folio.changePct > 0 ? "+" : ""}
                    {folio.changePct}%)
                  </span>
                )}
              </p>
              <ul className="mt-3 space-y-2">
                {folio.pieces.map((p) => (
                  <li key={p.id} className="flex gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl} alt={p.title} className="h-12 w-12 rounded object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{p.title}</p>
                      <p className="text-[11px] text-smoke">
                        paid {usd(p.paidCents)}
                        {p.topOfferCents && (
                          <span className="text-volt"> · live bid {usd(p.topOfferCents)}</span>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {folio.changePct > 0 && (
                <p className="mt-3 text-xs text-volt">
                  Their piece is up. That&apos;s a reason to reach out that isn&apos;t a sales
                  pitch.
                </p>
              )}
            </section>
          )}

          {taste && (
            <section className="rounded-xl border border-edge bg-surface p-5">
              <h2 className="display text-xl text-white">What they&apos;re into</h2>
              <p className="mt-1 text-xs text-smoke">
                From {taste.signalCount} votes and ratings on the site — what they like, not what
                they&apos;ve already bought.
              </p>
              <p className="mt-2 text-sm text-white">
                {taste.archetype.emoji} {taste.archetype.title}
              </p>
              {taste.brands.length > 0 && (
                <p className="mt-2 text-xs text-smoke">
                  Brands: <span className="text-white">{taste.brands.map((b) => b.name).join(", ")}</span>
                </p>
              )}
              {taste.silhouettes.length > 0 && (
                <p className="mt-1 text-xs text-smoke">
                  Silhouettes:{" "}
                  <span className="text-white">{taste.silhouettes.map((b) => b.name).join(", ")}</span>
                </p>
              )}
              {taste.colorways.length > 0 && (
                <p className="mt-1 text-xs text-smoke">
                  Colours: <span className="text-white">{taste.colorways.map((b) => b.name).join(", ")}</span>
                </p>
              )}
            </section>
          )}

          {contact.shoeSize && sameSize.length > 1 && (
            <section className="rounded-xl border border-edge bg-surface p-5">
              <h2 className="display text-xl text-white">Same size</h2>
              <p className="mt-1 text-xs text-smoke">
                {sameSize.length - 1} other {sameSize.length === 2 ? "person" : "people"} on your
                list wears {contact.shoeSize}. If a pair doesn&apos;t land with one of them,
                it fits the others.
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {sameSize
                  .filter((c) => c.id !== contact.id)
                  .slice(0, 6)
                  .map((c) => (
                    <li key={c.id}>
                      <Link href={`/studio/contacts/${c.id}`} className="text-white hover:text-volt">
                        {c.name}
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {Object.keys(custom).length > 0 && (
            <section className="rounded-xl border border-edge bg-surface p-5">
              <h2 className="display text-xl text-white">From your old CRM</h2>
              <p className="mt-1 text-xs text-smoke">
                Columns your export had that we don&apos;t have a field for. Kept rather than
                dropped.
              </p>
              <dl className="mt-2 space-y-1.5 text-xs">
                {Object.entries(custom).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="shrink-0 text-smoke">{k}:</dt>
                    <dd className="min-w-0 break-words text-white">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {contact.notes && (
            <section className="rounded-xl border border-edge bg-surface p-5">
              <h2 className="display text-xl text-white">Notes</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-smoke">{contact.notes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
