import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { contactBook, contactStats } from "@/lib/contacts";
import { isPro, PRICE_MONTHLY_CENTS, priceLabel } from "@/lib/plans";
import { syncContactsAction, touchContactAction, deleteContactAction } from "@/app/actions";
import ContactImport from "./ContactImport";
import ContactForm from "./ContactForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your Customers — The Heat Chart Studio" };

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/**
 * The customer book.
 *
 * A maker's business is repeat commissions, and until now the site held
 * that relationship as scattered rows — a sale here, an offer there, a
 * message thread somewhere else — with no way to ask the only question
 * that matters: who bought from me, what did they spend, and when did I
 * last speak to them.
 *
 * Sorted by lifetime spend, because that's the order you should work the
 * list in. Quiet customers are surfaced first, because the cheapest sale
 * a maker will ever make is the second one to someone who already said
 * yes.
 */
export default async function ContactsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?next=/studio/contacts");

  const artist = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true, status: true, displayName: true,
      plan: true, planStatus: true, paidThrough: true,
    },
  });
  if (!artist || artist.status !== "APPROVED") redirect("/submit");

  // Gated, but never destructively. A lapsed artist's contacts are not
  // deleted and not hidden from them forever — the list is still theirs
  // and it's still here, they just can't open it until they're back on
  // Pro. Holding someone's customer list hostage would be a reason to
  // never trust the platform with it in the first place; deleting it
  // would be worse.
  if (!isPro(artist)) {
    const held = await prisma.contact.count({ where: { artistId: artist.id } });
    return (
      <div className="mx-auto max-w-2xl px-4 py-14">
        <p className="tag text-volt">Artist Pro</p>
        <h1 className="display mt-2 text-4xl text-white">Your customer list</h1>
        <p className="mt-3 text-smoke">
          Everyone who bought from you, what they spent, and who&apos;s gone quiet — with import
          from your phone, Gmail or Shopify. It&apos;s part of Pro.
        </p>
        {held > 0 && (
          <p className="mt-4 rounded-lg border border-volt/40 bg-volt/5 px-4 py-3 text-sm text-volt">
            You already have {held} {held === 1 ? "contact" : "contacts"} saved here. Nothing was
            deleted — it&apos;s waiting for you.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pricing" className="rounded-lg btn-hard px-6 py-3 tag font-bold">
            See Pro — {priceLabel(PRICE_MONTHLY_CENTS)}/mo
          </Link>
          <Link
            href="/studio"
            className="rounded-lg border border-edge px-6 py-3 tag font-bold text-white transition hover:border-volt"
          >
            Back to the Studio
          </Link>
        </div>
      </div>
    );
  }

  const [book, stats] = await Promise.all([
    contactBook(artist.id),
    contactStats(artist.id),
  ]);

  const quiet = book.filter((c) => c.purchaseCount > 0 && (c.daysQuiet ?? 0) > 120);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="tag text-volt">Studio</p>
      <h1 className="display mt-1 text-4xl text-white">Your Customers</h1>
      <p className="mt-2 text-sm text-smoke">
        Everyone who&apos;s bought from you, asked about a commission, or landed in your phone.
        Yours alone — no other artist on the platform can see this list.
      </p>
      <Link href="/studio" className="mt-2 inline-block tag text-smoke underline hover:text-white">
        ← Back to the Studio
      </Link>

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Contacts", value: String(stats.total) },
          { label: "Bought from you", value: String(stats.customers) },
          { label: "Came back", value: `${stats.repeat}`, sub: `${stats.repeatPct}% of buyers` },
          { label: "Lifetime spend", value: usd(stats.totalSpentCents) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-edge bg-panel px-3 py-2.5">
            <p className="tag text-smoke">{s.label}</p>
            <p className="display mt-0.5 text-2xl tabular-nums text-white">{s.value}</p>
            {s.sub && <p className="mt-0.5 text-[11px] text-smoke">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Import first — an empty list is one nobody opens twice. */}
      <section className="mt-8 rounded-xl border border-volt/40 bg-surface p-5">
        <h2 className="display text-xl text-white">Bring your list in</h2>
        <p className="mt-1 text-sm text-smoke">
          Export contacts from your phone, Gmail, or Shopify and drop the CSV here. Importing the
          same file twice is safe — it updates what&apos;s there instead of doubling it.
        </p>
        <div className="mt-4">
          <ContactImport />
        </div>

        <div className="mt-5 border-t border-edge pt-4">
          <p className="text-sm text-white">Already sold through The Heat Chart?</p>
          <p className="mt-1 text-xs text-smoke">
            Pull your confirmed sales in as customers, with what each person actually spent.
          </p>
          <form action={syncContactsAction} className="mt-2">
            <button className="rounded-lg border border-volt px-4 py-2 tag font-bold text-volt transition hover:bg-volt/10">
              Add my buyers
            </button>
          </form>
        </div>
      </section>

      {quiet.length > 0 && (
        <section className="mt-6 rounded-xl border border-heat/40 bg-surface p-5">
          <h2 className="display text-xl text-heat">Worth a message</h2>
          <p className="mt-1 text-xs text-smoke">
            {quiet.length} {quiet.length === 1 ? "person who bought" : "people who bought"} from
            you and hasn&apos;t heard from you in four months. The second sale to someone who
            already said yes is the cheapest one you&apos;ll ever make.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {quiet.slice(0, 8).map((c) => (
              <li key={c.id} className="text-smoke">
                <span className="text-white">{c.name}</span> · spent {usd(c.totalSpentCents)} ·{" "}
                {c.daysQuiet}d quiet
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-edge bg-surface p-5">
        <h2 className="display text-xl text-white">Add someone</h2>
        <div className="mt-3">
          <ContactForm />
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl text-white">The book</h2>
          <p className="tag text-smoke">Biggest spenders first</p>
        </div>

        {book.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-edge bg-surface p-8 text-center text-sm text-smoke">
            Nothing here yet. Import a CSV above, or pull in your buyers.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {book.map((c) => (
              <li key={c.id} className="rounded-lg border border-edge bg-panel p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">
                      {c.name}
                      {c.purchaseCount > 1 && (
                        <span className="ml-2 rounded-full border border-volt/50 px-2 py-0.5 tag text-volt">
                          repeat
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-smoke">
                      {[c.email, c.phone, c.social ? `@${c.social}` : null, c.city]
                        .filter(Boolean)
                        .join(" · ") || "No contact details yet"}
                    </p>
                    <p className="mt-0.5 text-xs text-smoke">
                      {c.purchaseCount > 0 ? (
                        <>
                          <span className="font-bold text-volt tabular-nums">
                            {usd(c.totalSpentCents)}
                          </span>{" "}
                          across {c.purchaseCount}{" "}
                          {c.purchaseCount === 1 ? "purchase" : "purchases"}
                        </>
                      ) : (
                        "Hasn't bought yet"
                      )}
                      {c.daysQuiet !== null && ` · ${c.daysQuiet}d since last contact`}
                      {!c.emailOptIn && c.email && (
                        <span className="text-smoke"> · not opted in to email</span>
                      )}
                    </p>
                    {c.notes && <p className="mt-1 text-xs text-smoke">{c.notes}</p>}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <form action={touchContactAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="rounded border border-edge px-2 py-1 tag text-smoke transition hover:border-volt hover:text-white">
                        Spoke today
                      </button>
                    </form>
                    <form action={deleteContactAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="rounded border border-edge px-2 py-1 tag text-smoke transition hover:border-heat hover:text-heat">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer tag text-smoke hover:text-white">Edit</summary>
                  <div className="mt-2">
                    <ContactForm
                      defaults={{
                        id: c.id,
                        name: c.name,
                        email: c.email,
                        phone: c.phone,
                        social: c.social,
                        city: c.city,
                        notes: c.notes,
                        emailOptIn: c.emailOptIn,
                      }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-xs text-smoke">
        Imported contacts are never marked as opted in to email, whatever the file says — a phone
        book isn&apos;t a mailing list, and sending to one is how a domain stops reaching inboxes
        for everybody. Tick the box on a contact only when they actually said yes.
      </p>
    </div>
  );
}
