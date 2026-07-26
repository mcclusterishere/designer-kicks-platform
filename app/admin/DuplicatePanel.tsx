import { findDuplicatePieces } from "@/lib/dupes";
import MergeGroup from "./MergeGroup";

/**
 * The same shoe, posted twice.
 *
 * Shows candidate groups and lets a human pick which listing survives.
 * Deliberately never merges on its own: the detector matches on a
 * normalised title, which is good enough to SUGGEST and nowhere near good
 * enough to act — an artist with "Afro Samurai 1" and "Afro Samurai 2" as
 * two genuinely different pairs would lose one to a confident script.
 *
 * Photos are the reason this is needed and the reason it's careful. These
 * duplicates exist because uploads were failing and artists were told to
 * re-upload, so the older row usually holds the votes and the newer one
 * holds the only working pictures. The merge keeps both.
 */
export default async function DuplicatePanel() {
  const groups = await findDuplicatePieces();

  return (
    <section className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl text-white">Same shoe, posted twice</h2>
        <p className="tag text-smoke">{groups.length} to look at</p>
      </div>

      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-smoke">
          No duplicates found. Every artist&apos;s pieces have distinct titles.
        </p>
      ) : (
        <>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-smoke">
            These look like one pair posted more than once — usually from the stretch when
            uploads were failing and artists re-posted. Pick the listing to keep. Every photo
            from the others moves onto it, and the spares are{" "}
            <span className="text-white">retired, not deleted</span> — their votes, offers and
            battle history stay exactly where they are, and it&apos;s one status change to undo.
          </p>
          <div className="mt-4 space-y-4">
            {groups.map((g) => (
              <MergeGroup key={g.key} group={JSON.parse(JSON.stringify(g))} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
