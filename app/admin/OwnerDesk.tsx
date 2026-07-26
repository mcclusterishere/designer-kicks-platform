import { unverifiedOwners } from "@/lib/ownership";
import { verifyOwnerAction, resendOwnerVerifyAction } from "@/app/actions";

/**
 * Owners named but not yet confirmed.
 *
 * An artist saying "Marcus owns this" is a claim. The owner confirming
 * makes it a fact. This is the desk for the gap between the two — the
 * people worth a phone call, because a confirmed owner is a collector
 * page, a provenance record, and a piece that can be resold, and an
 * unconfirmed one is none of those things.
 *
 * The contact details are here precisely so a human can reach out. That
 * is also why this component exists only inside the admin console and
 * why nothing it renders is ever passed to a public page.
 */
export default async function OwnerDesk() {
  const rows = await unverifiedOwners(60);

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-edge bg-surface p-5">
        <p className="tag text-heat">Ownership</p>
        <p className="mt-1 text-sm text-smoke">
          Nothing waiting. Every named owner has confirmed.
        </p>
      </section>
    );
  }

  const stale = rows.filter((r) => r.daysWaiting >= 3);

  return (
    <section className="rounded-xl border border-heat/40 bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl text-white">Owners to verify</h2>
        <p className="tag text-smoke">
          {rows.length} waiting{stale.length > 0 && ` · ${stale.length} over 3 days`}
        </p>
      </div>
      <p className="mt-1 text-xs text-smoke">
        The artist named them and we emailed a confirmation link. Until they click it, this is the
        artist&apos;s word rather than proof — the piece has no verified provenance and
        can&apos;t be resold. Worth a call for anything over a few days.
      </p>

      <ul className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-edge bg-panel p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.imageUrl} alt={r.title} className="h-14 w-14 shrink-0 rounded object-cover" />
                <div className="min-w-0">
                  <p className="truncate font-bold text-white">{r.title}</p>
                  <p className="text-xs text-smoke">
                    by {r.artist?.displayName ?? r.artistName}
                    {" · "}
                    <span className={r.daysWaiting >= 3 ? "text-heat" : ""}>
                      {r.daysWaiting === 0 ? "today" : `${r.daysWaiting}d waiting`}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-white">
                    {r.ownerName ? `${r.ownerName} · ` : ""}
                    <a href={`mailto:${r.ownerEmail}`} className="underline hover:text-volt">
                      {r.ownerEmail}
                    </a>
                    {r.ownerPhone && (
                      <>
                        {" · "}
                        <a href={`tel:${r.ownerPhone}`} className="underline hover:text-volt">
                          {r.ownerPhone}
                        </a>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-1.5">
                <form action={resendOwnerVerifyAction}>
                  <input type="hidden" name="submissionId" value={r.id} />
                  <button className="tag rounded border border-edge px-2.5 py-1.5 text-smoke transition hover:border-volt hover:text-white">
                    Email again
                  </button>
                </form>
                {/* The manual override, for when confirmation happened on
                    a phone call or in a DM rather than through the link.
                    Recorded as verifiedBy "admin" so the two are always
                    tellable apart afterwards. */}
                <form action={verifyOwnerAction}>
                  <input type="hidden" name="submissionId" value={r.id} />
                  <button className="tag rounded border border-volt px-2.5 py-1.5 font-bold text-volt transition hover:bg-volt/10">
                    Verified by hand
                  </button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
