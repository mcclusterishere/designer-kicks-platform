"use client";

import { useState, useActionState } from "react";
import {
  startAdminTotpSetup,
  confirmAdminTotp,
  disableAdminTotp,
  type ActionResult,
  type TotpSetupResult,
} from "@/app/actions";

export default function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<TotpSetupResult | null>(null);
  const [starting, setStarting] = useState(false);

  const [confirmState, confirmAction, confirming] = useActionState<ActionResult | null, FormData>(
    confirmAdminTotp,
    null
  );
  const [disableState, disableAction, disabling] = useActionState<ActionResult | null, FormData>(
    async () => disableAdminTotp(),
    null
  );

  const beginSetup = async () => {
    setStarting(true);
    const res = await startAdminTotpSetup();
    setSetup(res);
    setStarting(false);
  };

  // The server re-renders with a fresh `enabled` after confirm/disable
  // (both revalidate /admin), so the prop is the source of truth.
  const on = enabled;

  return (
    <div className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="tag text-volt">Two-step verification</p>
          <p className="mt-1 text-sm text-smoke">
            Add an authenticator-app code (Google Authenticator, Authy, 1Password)
            on top of the admin password.
          </p>
        </div>
        <span
          className={`tag rounded-full border px-3 py-1 ${
            on ? "border-volt text-volt" : "border-edge text-smoke"
          }`}
        >
          {on ? "On" : "Off"}
        </span>
      </div>

      {/* Already on → offer to turn it off */}
      {on && (
        <form action={disableAction} className="mt-4">
          <button
            type="submit"
            disabled={disabling}
            className="rounded-lg border border-heat px-4 py-2 tag text-heat disabled:opacity-50"
          >
            {disabling ? "Turning off…" : "Turn off 2FA"}
          </button>
          {disableState?.note && <span className="ml-3 tag text-smoke">{disableState.note}</span>}
        </form>
      )}

      {/* Off → start enrollment */}
      {!on && !setup && (
        <button
          type="button"
          onClick={beginSetup}
          disabled={starting}
          className="mt-4 rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
        >
          {starting ? "Generating…" : "Set up 2FA"}
        </button>
      )}

      {/* Enrollment: show the key + otpauth, confirm with a live code */}
      {!on && setup?.secret && (
        <div className="mt-4 space-y-3">
          <div>
            <p className="tag text-smoke">1 · Add this key to your authenticator app</p>
            <p className="mt-1 text-xs text-smoke">
              In your app choose “add account → enter a setup key manually”, then
              paste the key below (account: The Heat Chart).
            </p>
            <code className="mt-2 block break-all rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-sm tracking-wider text-volt">
              {setup.secret}
            </code>
            {setup.uri && (
              <p className="mt-1 break-all text-[11px] text-smoke/60">{setup.uri}</p>
            )}
          </div>
          <form action={confirmAction} className="space-y-2">
            <p className="tag text-smoke">2 · Enter the 6-digit code it shows now</p>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              className="w-40 rounded-lg border border-edge bg-panel px-3 py-2.5 tracking-[0.3em] text-white focus:border-volt focus:outline-none"
            />
            <div>
              <button
                type="submit"
                disabled={confirming}
                className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
              >
                {confirming ? "Checking…" : "Turn on 2FA"}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmState?.error && (
        <p className="mt-3 rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
          {confirmState.error}
        </p>
      )}
      {confirmState?.ok && confirmState.note && (
        <p className="mt-3 rounded border border-volt/40 bg-volt/10 px-3 py-2 text-sm text-volt">
          {confirmState.note}
        </p>
      )}
    </div>
  );
}
