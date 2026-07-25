import { galleryRun, galleryEvidence, galleryPitch } from "@/lib/galleryOutreach";
import { galleryTouchAction } from "@/app/actions";

/**
 * The Gallery Run — today's outreach queue, with the letter already written.
 *
 * Automated in the way that actually survives contact with reality: the
 * queue computes itself from the follow-up clock, the letter is generated
 * from real sale data, and sending is one click that also stops the clock.
 *
 * Deliberately NOT a silent auto-blast, for two reasons worth writing down
 * so nobody "fixes" it later. Cold commercial email has rules — accurate
 * sender, a real postal address, a working opt-out — and a queue that
 * fires on a timer will breach them the first time a template changes.
 * More practically, blasting cold email from the same domain that sends
 * password resets is how a sending reputation dies, and when it dies the
 * password resets die with it. One click, from a queue that never forgets,
 * is the automation that's worth having.
 */
export default async function GalleryRun() {
  const [queue, evidence] = await Promise.all([galleryRun(12), galleryEvidence(3)]);

  if (queue.length === 0) {
    return (
      <div className="rounded-xl border border-edge bg-surface p-4">
        <p className="tag text-heat">Gallery Run</p>
        <p className="mt-1 text-sm text-smoke">
          Nothing due. Scan a city above to stage galleries, or everyone on the board has
          been touched inside their follow-up window.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="tag text-heat">Gallery Run</p>
        <p className="tag text-smoke">{queue.length} due today</p>
      </div>
      <p className="mt-1 text-xs text-smoke">
        Sorted by urgency. The letter under each one is written from confirmed sales only —
        if a maker has no record yet it says so rather than inflating one.
      </p>

      <ul className="mt-3 space-y-3">
        {queue.map((g) => {
          const pitch = galleryPitch({ name: g.name, kind: "GALLERY" }, evidence);
          return (
            <li key={g.id} className="rounded-lg border border-edge bg-panel p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{g.name}</p>
                  <p className="tag text-smoke">
                    {g.status}
                    {g.daysSinceTouch !== null && ` · ${g.daysSinceTouch}d since last touch`}
                    {g.touchCount > 0 && ` · ${g.touchCount} sent`}
                    {g.cold && <span className="text-heat"> · cold</span>}
                  </p>
                  {g.address && <p className="mt-0.5 text-xs text-smoke">{g.address}</p>}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {g.website && (
                    <a
                      href={g.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-edge px-2 py-1 tag text-smoke hover:text-white"
                    >
                      Site ↗
                    </a>
                  )}
                  {g.email && (
                    <a
                      href={`mailto:${g.email}?subject=${encodeURIComponent(pitch.subject)}&body=${encodeURIComponent(pitch.body)}`}
                      className="rounded border border-heat px-2 py-1 tag font-bold text-heat"
                    >
                      Open email
                    </a>
                  )}
                </div>
              </div>

              <p className="mt-2 text-xs text-white">{g.reason}</p>
              <p className="text-xs text-smoke">{g.action}</p>

              <details className="mt-2">
                <summary className="cursor-pointer tag text-smoke hover:text-white">
                  Read the letter
                </summary>
                <p className="mt-1.5 text-xs font-bold text-white">{pitch.subject}</p>
                <pre className="mt-1 whitespace-pre-wrap font-sans text-xs leading-relaxed text-smoke">
                  {pitch.body}
                </pre>
              </details>

              {/* Recording the send is what stops it resurfacing tomorrow
                  and being pitched twice. */}
              <form action={galleryTouchAction} className="mt-2 flex flex-wrap gap-1.5">
                <input type="hidden" name="id" value={g.id} />
                {(["INVITED", "QUALIFIED", "JOINED", "PASSED"] as const).map((s) => (
                  <button
                    key={s}
                    name="status"
                    value={s}
                    className="rounded border border-edge px-2 py-1 tag text-smoke transition hover:border-volt hover:text-white"
                  >
                    {s === "INVITED" ? "Mark sent" : s === "QUALIFIED" ? "Researched" : s === "JOINED" ? "They're in" : "Pass"}
                  </button>
                ))}
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
