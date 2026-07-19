"use client";

import { useState } from "react";
import Link from "next/link";
import { getCallOutOptions, throwCallOut, type CallOutOption } from "@/app/actions";

/**
 * The profile-page duel: an approved artist standing on a rival's page
 * can challenge any piece — pick a fighter from their own rack (sorted
 * by closest Heat Score) and the battle goes live on the spot.
 */
export default function ChallengeButton({ targetSubmissionId }: { targetSubmissionId: string }) {
  const [state, setState] = useState<
    | { s: "idle" }
    | { s: "picking"; options: CallOutOption[] }
    | { s: "sent"; battleId: string }
    | { s: "error"; message: string }
  >({ s: "idle" });

  async function open() {
    const res = await getCallOutOptions(targetSubmissionId);
    if (res.ok) setState({ s: "picking", options: res.options });
    else setState({ s: "error", message: res.error });
  }

  async function pick(id: string) {
    const res = await throwCallOut(targetSubmissionId, id);
    if (res.ok) setState({ s: "sent", battleId: res.battleId });
    else setState({ s: "error", message: res.error });
  }

  if (state.s === "sent") {
    return (
      <p className="mt-2 text-sm text-heat">
        Challenge live ·{" "}
        <Link href={`/battles/${state.battleId}`} className="text-volt underline underline-offset-4">
          watch the battle →
        </Link>
      </p>
    );
  }
  return (
    <div className="mt-2">
      {state.s === "idle" && (
        <button
          type="button"
          onClick={open}
          data-testid="profile-challenge"
          className="tag rounded-full border border-heat/60 px-3 py-1.5 text-heat transition hover:border-heat hover:text-white"
        >
          Challenge this piece
        </button>
      )}
      {state.s === "picking" && (
        <div className="rounded-xl border border-heat/40 bg-panel p-3">
          <p className="tag text-heat">Pick your fighter — closest heat first</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {state.options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => pick(o.id)}
                className="tag rounded-full border border-edge px-3 py-1.5 text-white transition hover:border-heat"
              >
                {o.title}
                {o.heat !== null && <span className="text-smoke"> · {o.heat.toFixed(1)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {state.s === "error" && <p className="text-sm text-smoke">{state.message}</p>}
    </div>
  );
}
