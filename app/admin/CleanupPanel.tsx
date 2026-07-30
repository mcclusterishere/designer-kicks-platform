import { classifyAccounts } from "@/lib/purge";
import CleanupForm from "./CleanupForm";

/**
 * Clearing out the accounts that were never people.
 *
 * The whole panel exists to force one distinction to be visible before
 * anything is destroyed: an account nobody has logged into is not the same
 * thing as an account that was never a person. Most of the roster hasn't
 * logged in — that's what a pre-loaded artist page IS. Deleting on
 * "unclaimed" alone would empty the gallery.
 *
 * So the piles are shown separately, with the cost of each delete spelled
 * out in pieces and votes, and the fixtures pre-ticked because those are the
 * only ones that are unambiguous.
 */
export default async function CleanupPanel() {
  const rows = await classifyAccounts();
  const demo = rows.filter((r) => r.kind === "demo");
  const roster = rows.filter((r) => r.kind === "roster");
  const claimed = rows.filter((r) => r.kind === "claimed");
  const staff = rows.filter((r) => r.kind === "staff");

  return (
    <section className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl text-white">Clear out the fake accounts</h2>
        <p className="tag text-smoke">{rows.length} total</p>
      </div>

      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-smoke">
        Three different things look identical in a user list. Test rows left over from
        building the site. Real artists whose pages we built for them, who haven&apos;t
        walked in yet. And people who actually signed in. Only the first pile is safe to
        delete — the second pile is the gallery customers come to look at.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tally n={demo.length} label="test rows" tone="text-heat" />
        <Tally n={roster.length} label="real, not logged in" tone="text-volt" />
        <Tally n={claimed.length} label="signed in" tone="text-white" />
        <Tally n={staff.length} label="staff" tone="text-smoke" />
      </div>

      <CleanupForm demo={demo} roster={roster} />

      {claimed.length > 0 && (
        <div className="mt-5 rounded-lg border border-edge bg-panel p-4">
          <p className="tag text-white">Real people — never deleted here</p>
          <p className="mt-1 text-xs text-smoke">
            These accounts have been signed into. There is no button on this page that can
            remove them.
          </p>
          <ul className="mt-2 space-y-1">
            {claimed.map((c) => (
              <li key={c.userId} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="text-white">{c.artistName ?? c.name ?? c.email}</span>
                <span className="min-w-0 break-all text-xs text-smoke">{c.email}</span>
                <span className="text-xs text-smoke">
                  · {c.why.toLowerCase()} · {c.pieces} piece{c.pieces === 1 ? "" : "s"}
                  {c.foundingNumber !== null && ` · Founding #${c.foundingNumber}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Tally({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-lg border border-edge bg-panel p-3">
      <p className={`display text-2xl ${tone}`}>{n}</p>
      <p className="mt-0.5 text-xs leading-tight text-smoke">{label}</p>
    </div>
  );
}
