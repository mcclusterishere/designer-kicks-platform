"use client";

import { useActionState } from "react";
import { socialChannelAction } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

type Acct = {
  id: string;
  handle: string | null;
  name: string | null;
  autoPromote: boolean;
  status: string;
  lastPostedAt: Date | string | null;
  lastError: string | null;
};

/**
 * One provider's row: either a connect button, or the connected
 * account(s) with their pause/disconnect controls. A channel whose
 * token died shows "reconnect" in plain words instead of silently
 * dropping every future post.
 */
export default function ChannelRow({
  provider,
  label,
  need,
  accounts,
}: {
  provider: string;
  label: string;
  need: string;
  accounts: Acct[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    socialChannelAction,
    null
  );

  if (accounts.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-edge bg-panel p-3">
        <span className="min-w-0">
          <span className="block text-sm text-white">{label}</span>
          <span className="block text-xs text-smoke">{need}</span>
        </span>
        <a
          href={`/api/social/connect/${provider}`}
          className="shrink-0 rounded-lg btn-hard px-4 py-2 tag font-bold"
        >
          Connect
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-edge bg-panel p-3">
      {accounts.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm text-white">
              {label} · {a.handle ?? a.name ?? "connected"}
            </span>
            <span className="block text-xs text-smoke">
              {a.status !== "ACTIVE" ? (
                <span className="text-heat">Connection expired — reconnect below</span>
              ) : a.autoPromote ? (
                a.lastPostedAt
                  ? `Auto-posting · last post ${String(a.lastPostedAt).slice(0, 10)}`
                  : "Auto-posting when your next piece goes live"
              ) : (
                "Paused — connected but not posting"
              )}
            </span>
          </span>
          <form action={formAction} className="flex shrink-0 gap-2">
            <input type="hidden" name="accountId" value={a.id} />
            {a.status === "ACTIVE" ? (
              <button
                name="op"
                value="toggle"
                disabled={pending}
                className="rounded-lg border border-edge px-3 py-1.5 tag text-smoke transition hover:text-white disabled:opacity-50"
              >
                {a.autoPromote ? "Pause" : "Resume"}
              </button>
            ) : (
              <a href={`/api/social/connect/${provider}`} className="rounded-lg btn-hard px-3 py-1.5 tag font-bold">
                Reconnect
              </a>
            )}
            <button
              name="op"
              value="disconnect"
              disabled={pending}
              className="rounded-lg border border-edge px-3 py-1.5 tag text-smoke transition hover:text-heat disabled:opacity-50"
            >
              Disconnect
            </button>
          </form>
        </div>
      ))}
      {state?.error && <p className="mt-2 text-sm text-heat" role="alert">{state.error}</p>}
      {state?.ok && state.note && <p className="mt-2 text-sm text-volt">{state.note}</p>}
    </div>
  );
}
