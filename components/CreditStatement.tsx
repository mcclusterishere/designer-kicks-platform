/**
 * Your credits, and where every one of them went.
 *
 * A balance nobody can audit is just a number the house asserts. Each row
 * is a real ledger entry with the balance it produced, written under the
 * same lock as the movement itself — so this isn't a reconstruction, it's
 * the record. Anyone can check the arithmetic down the column.
 */
const LABELS: Record<string, string> = {
  "call-stake": "Staked on a call",
  "call-payout": "Call paid out",
  "call-stake-refund": "Call refunded",
  "call-void": "Call voided — stake returned",
  "call-points": "Called it right",
  strike: "Strike in the Heat Check",
  "iq-clear": "Cleared a miss",
  purchase: "Bought a pack",
  "purchase-dev": "Bought a pack",
  league: "League prize",
  quiz: "Heat Check reward",
};

function label(reason: string) {
  return LABELS[reason] ?? reason.replace(/-/g, " ");
}

export default function CreditStatement({
  entries,
  balance,
}: {
  entries: {
    id: string;
    delta: number;
    reason: string;
    balanceAfter: number | null;
    note: string | null;
    createdAt: Date;
  }[];
  balance: number;
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="tag text-heat">Credit statement</p>
        <p className="tag text-smoke">
          balance <span className="font-bold text-white">{balance}</span>
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-smoke">
          Nothing has moved yet. Credits are earned by playing and spent on entries.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-edge/60">
          {entries.map((e) => (
            <li key={e.id} className="flex items-baseline justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm text-white">{label(e.reason)}</span>
                <span className="block text-xs text-smoke">
                  {e.createdAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-right font-mono tabular-nums">
                <span className={`block text-sm font-bold ${e.delta < 0 ? "text-heat" : "text-volt"}`}>
                  {e.delta > 0 ? "+" : ""}
                  {e.delta}
                </span>
                {/* The balance that entry produced, stamped at the time. */}
                {e.balanceAfter !== null && (
                  <span className="block text-xs text-smoke">{e.balanceAfter}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="tag mt-3 leading-relaxed text-smoke">
        Credits are play money — earned by playing, spent on entries. They are never
        cash and never pay out as cash.
      </p>
    </div>
  );
}
