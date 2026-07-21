"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/account-actions";
import type { ActionResult } from "@/app/actions";

type State = (ActionResult & { devResetLink?: string }) | null;

export default function ForgotForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    requestPasswordReset,
    null
  );

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-volt/50 bg-surface p-6">
        <p className="text-white">
          If an account exists for that email, a reset link is on its way.
          Check your inbox (and spam).
        </p>
        {state.devResetLink && (
          <p className="mt-4 rounded border border-heat/40 bg-heat/10 p-3 text-xs text-smoke">
            <span className="tag text-heat">Dev mode</span> — no email service
            is configured, so here&apos;s your link directly:{" "}
            <a href={state.devResetLink} className="break-all text-volt underline">
              {state.devResetLink}
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="tag text-smoke">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white focus:border-volt focus:outline-none"
        />
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg btn-hard py-3 tag font-bold disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send Reset Link"}
      </button>
    </form>
  );
}
