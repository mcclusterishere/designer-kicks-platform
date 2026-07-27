import { staffActions } from "@/lib/audit";

/**
 * The staff action log.
 *
 * Lives under Settings rather than a queue tab because it is not work to
 * be done — it is the record of work already done, kept so that "who
 * changed this?" always has an answer. Every entry here is also visible
 * to the person whose content it concerns, in their own Studio.
 */
export default async function AuditPanel() {
  const rows = await staffActions(60);

  return (
    <section className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl text-white">Staff action log</h2>
        <p className="tag text-smoke">{rows.length} recorded</p>
      </div>
      <p className="mt-1 text-xs text-smoke">
        Every time you or an editor touches content belonging to someone else. The affected artist
        sees their own entries in their Studio — this log is not private to us, by design.
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-smoke">
          Nothing yet. Editing your own work is never logged, only somebody else&apos;s.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="tag text-smoke">
              <tr>
                <th className="py-1.5 pr-4">When</th>
                <th className="py-1.5 pr-4">Who</th>
                <th className="py-1.5 pr-4">Did what</th>
                <th className="py-1.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-edge">
                  <td className="whitespace-nowrap py-1.5 pr-4 text-smoke">
                    {r.createdAt.toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </td>
                  <td className="py-1.5 pr-4 text-smoke">
                    {r.actorEmail ?? r.actorRole}
                  </td>
                  <td className="py-1.5 pr-4 text-white">{r.summary}</td>
                  <td className="py-1.5 tag text-smoke">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
