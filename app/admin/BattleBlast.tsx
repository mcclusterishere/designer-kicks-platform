"use client";

import { useActionState } from "react";
import { blastBattle, type BlastState } from "./blastActions";

type BattleOption = {
  id: string;
  label: string;
};

/**
 * Battle Blast — pick a live battle, fire "which do you prefer?" with
 * both photos + the vote link at every configured instant channel
 * (X, Bluesky, Telegram, Discord, Reddit) in one click. Per-channel
 * results land inline so a dead key is obvious immediately.
 */
export default function BattleBlast({
  battles,
  channels,
}: {
  battles: BattleOption[];
  channels: { channel: string; configured: boolean }[];
}) {
  const [state, formAction, pending] = useActionState<BlastState | null, FormData>(
    blastBattle,
    null
  );
  const live = channels.filter((c) => c.configured);

  return (
    <div className="rounded-2xl border border-edge bg-surface p-5">
      <h3 className="display text-xl text-white">Battle Blast</h3>
      <p className="mt-1 text-sm text-smoke">
        “Which do you prefer? Come vote.” — both photos + the battle link,
        posted to every connected channel at once.
      </p>

      {/* Pipe status at a glance */}
      <div className="mt-3 flex flex-wrap gap-2">
        {channels.map((c) => (
          <span
            key={c.channel}
            className={`tag rounded-full border px-2.5 py-1 ${
              c.configured ? "border-volt/50 text-volt" : "border-edge text-smoke/60"
            }`}
          >
            {c.configured ? "●" : "○"} {c.channel}
          </span>
        ))}
      </div>

      {battles.length === 0 ? (
        <p className="mt-4 text-sm text-smoke">No active battles to blast right now.</p>
      ) : (
        <form action={formAction} className="mt-4 space-y-3">
          <div>
            <label htmlFor="blast-battle" className="tag text-smoke">Battle</label>
            <select
              id="blast-battle"
              name="battleId"
              required
              className="mt-1 w-full rounded-lg border border-edge bg-ink px-3 py-2.5 text-white"
            >
              {battles.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="blast-text" className="tag text-smoke">
              Copy <span className="normal-case">(blank = the house line)</span>
            </label>
            <textarea
              id="blast-text"
              name="text"
              rows={2}
              maxLength={240}
              placeholder="🔥 Which one you got? Come cast your vote."
              className="mt-1 w-full rounded-lg border border-edge bg-ink px-3 py-2.5 text-white placeholder:text-smoke/50"
            />
          </div>
          <button
            type="submit"
            disabled={pending || live.length === 0}
            className="btn-hard w-full rounded-lg py-3 tag font-bold disabled:opacity-50"
          >
            {pending
              ? "Blasting…"
              : live.length === 0
                ? "Connect a channel to blast"
                : `Blast to ${live.length} channel${live.length === 1 ? "" : "s"}`}
          </button>
        </form>
      )}

      {state?.error && !state.results && (
        <p role="alert" className="mt-3 rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}
      {state?.results && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {state.results.map((r) => (
            <li key={r.channel} className="flex items-baseline gap-2">
              <span className={r.ok ? "text-volt" : "text-smoke/60"}>{r.ok ? "✓" : "—"}</span>
              <span className="text-white">{r.channel}</span>
              <span className="text-smoke">· {r.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
