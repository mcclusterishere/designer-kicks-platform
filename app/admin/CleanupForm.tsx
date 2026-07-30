"use client";

import { useActionState, useState } from "react";
import { purgeAccountsAction } from "@/app/actions";
import type { ActionResult } from "@/app/actions";
import type { AccountRow } from "@/lib/purge";

/**
 * Pick what goes, then type the word.
 *
 * Test rows start ticked because they are the answer to "delete the fake
 * accounts" and nothing about them is a judgement call. Real unclaimed
 * artists start unticked AND hidden behind a second switch, because the
 * mistake this form exists to prevent is deleting the gallery in one click
 * while believing you deleted the test data.
 *
 * The typed confirmation is checked again on the server. This copy is here
 * to slow a person down, not to enforce anything.
 */
export default function CleanupForm({ demo, roster }: { demo: AccountRow[]; roster: AccountRow[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    purgeAccountsAction,
    null
  );
  const [picked, setPicked] = useState<Set<string>>(() => new Set(demo.map((d) => d.userId)));
  const [showRoster, setShowRoster] = useState(false);
  const [confirm, setConfirm] = useState("");

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rosterPicked = roster.filter((r) => picked.has(r.userId));
  const chosen = [...demo, ...roster].filter((r) => picked.has(r.userId));
  const pieces = chosen.reduce((t, r) => t + r.pieces, 0);
  const votes = chosen.reduce((t, r) => t + r.votesOnTheirPieces, 0);

  if (state?.ok) {
    return (
      <div className="mt-4 rounded-lg border border-volt/40 bg-volt/5 p-4 text-sm text-white">
        ✓ {state.note} Reload the page to see the updated list.
      </div>
    );
  }

  if (demo.length === 0 && roster.length === 0) {
    return (
      <p className="mt-4 text-sm text-smoke">
        Nothing to clean up — every account here belongs to somebody.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-5">
      {demo.length > 0 && (
        <>
          <p className="tag text-heat">Test rows — safe to delete</p>
          <div className="mt-2 space-y-1.5">
            {demo.map((r) => (
              <Row key={r.userId} row={r} on={picked.has(r.userId)} onToggle={() => toggle(r.userId)} />
            ))}
          </div>
        </>
      )}

      {roster.length > 0 && (
        <div className="mt-5 rounded-lg border border-volt/30 bg-volt/5 p-4">
          <p className="tag text-volt">Real artists who haven&apos;t signed in yet</p>
          <p className="mt-1 text-sm leading-relaxed text-smoke">
            {roster.length} artist page{roster.length === 1 ? "" : "s"} we built from their
            actual work, waiting for them to claim. These are the pages customers browse.
            Deleting one deletes their shoes.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              name="allowRoster"
              checked={showRoster}
              onChange={(e) => {
                setShowRoster(e.target.checked);
                if (!e.target.checked) {
                  setPicked((prev) => {
                    const next = new Set(prev);
                    for (const r of roster) next.delete(r.userId);
                    return next;
                  });
                }
              }}
              className="h-4 w-4 accent-[#f04e45]"
            />
            I know these are real artists — let me delete some anyway
          </label>

          {showRoster && (
            <div className="mt-3 space-y-1.5">
              {roster.map((r) => (
                <Row
                  key={r.userId}
                  row={r}
                  on={picked.has(r.userId)}
                  onToggle={() => toggle(r.userId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {chosen.map((r) => (
        <input key={r.userId} type="hidden" name="userId" value={r.userId} />
      ))}

      <div className="mt-5 rounded-lg border border-edge bg-panel p-4">
        <p className="text-sm text-white">
          {chosen.length === 0 ? (
            "Nothing selected."
          ) : (
            <>
              Deleting <span className="text-heat">{chosen.length}</span> account
              {chosen.length === 1 ? "" : "s"}, <span className="text-heat">{pieces}</span> piece
              {pieces === 1 ? "" : "s"} and <span className="text-heat">{votes}</span> vote
              {votes === 1 ? "" : "s"} on them.
              {rosterPicked.length > 0 && (
                <>
                  {" "}
                  <span className="text-volt">
                    {rosterPicked.length} of those {rosterPicked.length === 1 ? "is" : "are"} a real
                    artist&apos;s page.
                  </span>
                </>
              )}
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-smoke">This cannot be undone. There is no backup to restore from.</p>

        <label className="mt-3 block text-sm text-smoke">
          Type DELETE to confirm
          <input
            name="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            placeholder="DELETE"
            className="mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white"
          />
        </label>

        {state?.error && (
          <p className="mt-2 text-sm text-heat" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || chosen.length === 0 || confirm.trim().toUpperCase() !== "DELETE"}
          className="mt-3 w-full rounded-lg btn-hard py-2.5 tag font-bold disabled:opacity-50"
        >
          {pending ? "Deleting…" : `Delete ${chosen.length} account${chosen.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </form>
  );
}

function Row({ row, on, onToggle }: { row: AccountRow; on: boolean; onToggle: () => void }) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border p-2.5 ${
        on ? "border-heat bg-heat/10" : "border-edge"
      }`}
    >
      <input
        type="checkbox"
        checked={on}
        onChange={onToggle}
        className="mt-1 h-4 w-4 shrink-0 accent-[#f04e45]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-white">
          {row.artistName ?? row.name ?? row.email}
        </span>
        <span className="block min-w-0 break-all text-xs text-smoke">{row.email}</span>
        <span className="block text-xs text-smoke">
          {row.pieces} piece{row.pieces === 1 ? "" : "s"} · {row.votesOnTheirPieces} vote
          {row.votesOnTheirPieces === 1 ? "" : "s"}
          {row.salesInvolved > 0 && ` · ${row.salesInvolved} sale${row.salesInvolved === 1 ? "" : "s"}`}
          {row.artistSlug && ` · /artists/${row.artistSlug}`}
        </span>
      </span>
    </label>
  );
}
