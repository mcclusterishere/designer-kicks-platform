import { actionsOnMyContent } from "@/lib/audit";

/**
 * "What staff did to your stuff."
 *
 * The half of an audit log that actually creates accountability. A record
 * only the operator can read is an operator's convenience. This one is
 * shown to the person whose work was touched, in their own Studio, which
 * is the difference between a platform that can be trusted with an
 * artist's catalogue and one that merely says it can.
 *
 * Renders nothing when nothing has happened — the common and correct case.
 */
export default async function StaffActivity({ userId }: { userId: string }) {
  const entries = await actionsOnMyContent(userId, 10);
  if (entries.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl text-white">Changes made by The Heat Chart</h2>
        <p className="tag text-smoke">{entries.length} recent</p>
      </div>
      <p className="mt-1 text-xs text-smoke">
        Everything our team has done to your work. We can help with your pieces — fix a photo,
        answer an offer, take something down — but never quietly. If something here looks wrong,
        tell us and we&apos;ll undo it.
      </p>

      <ul className="mt-3 space-y-1.5">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-white">{e.summary}</span>
            <span className="tag shrink-0 text-smoke">
              {e.actorRole.startsWith("editor") ? "editor" : "admin"} ·{" "}
              {e.createdAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
