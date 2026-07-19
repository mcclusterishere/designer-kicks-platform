"use client";

import { useActionState } from "react";
import { adminLogin, type ActionResult } from "@/app/actions";

export default function LoginForm({ twoFactor = false }: { twoFactor?: boolean }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    adminLogin,
    null
  );

  return (
    <form action={formAction} className="mx-auto mt-10 max-w-sm space-y-4">
      <label htmlFor="password" className="tag text-smoke">
        Admin password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        className="w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white focus:border-volt focus:outline-none"
      />
      {twoFactor && (
        <div>
          <label htmlFor="code" className="tag text-smoke">
            Authenticator code
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="6-digit code"
            className="mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 tracking-[0.3em] text-white focus:border-volt focus:outline-none"
          />
        </div>
      )}
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-volt py-3 tag font-bold text-ink disabled:opacity-50"
      >
        {pending ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}
