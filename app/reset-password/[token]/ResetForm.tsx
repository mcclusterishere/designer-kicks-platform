"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/account-actions";
import type { ActionResult } from "@/app/actions";
import PasswordField from "@/components/PasswordField";

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
          className="mt-4 inline-block rounded-lg btn-hard px-5 py-2.5 tag font-bold"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {/* Recovery is the path where a mistyped password hurts most: it is
          where someone already locked out goes, and getting it wrong here
          locks them out again with no obvious reason why. */}
      <PasswordField
        label="New password (8+ characters)"
        autoComplete="new-password"
        minLength={8}
        confirm
        confirmLabel="Type it again"
      />
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg btn-hard py-3 tag font-bold disabled:opacity-50"
      >
        {pending ? "Saving…" : "Set New Password"}
      </button>
    </form>
  );
}
