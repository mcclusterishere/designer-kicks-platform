"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/account-actions";
import type { ActionResult } from "@/app/actions";

export default function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    resetPassword,
    null
  );

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-volt/50 bg-surface p-6">
        <p className="text-white">Password updated. 🔐</p>
        <Link
          href="/signin"
          className="mt-4 inline-block rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="tag text-smoke">New password (8+ characters)</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white focus:border-volt focus:outline-none"
        />
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-volt py-3 tag font-bold text-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Set New Password"}
      </button>
    </form>
  );
}
