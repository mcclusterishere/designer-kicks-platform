"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerUser } from "@/app/account-actions";
import type { ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function RegisterForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    registerUser,
    null
  );

  // A note means something merged (a pre-loaded page attached, or a
  // claim is pending) — let them read it before moving on. Silent
  // success goes straight through.
  useEffect(() => {
    if (state?.ok && !state.note) {
      router.push("/profile");
      router.refresh();
    }
  }, [state?.ok, state?.note, router]);

  if (state?.ok && state.note) {
    return (
      <div className="space-y-4" data-testid="register-note">
        <p className="rounded-lg border border-volt/40 bg-volt/5 p-4 text-sm text-white">
          ✓ Account created. {state.note}
        </p>
        <button
          type="button"
          onClick={() => {
            router.push("/profile");
            router.refresh();
          }}
          className="w-full rounded-lg bg-volt py-3 tag font-bold text-ink"
        >
          Take Me To My Profile →
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className="tag text-smoke">Name</label>
        <input id="name" name="name" required maxLength={60} autoComplete="name" className={inputClass} />
      </div>
      <div>
        <label htmlFor="email" className="tag text-smoke">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="tag text-smoke">Password (8+ characters)</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </div>
      <label htmlFor="age13" className="flex items-start gap-2 text-sm text-smoke">
        <input id="age13" name="age13" type="checkbox" required className="mt-0.5 h-4 w-4 accent-[#d9b96a]" />
        <span>
          I&apos;m at least 13 years old. The Heat Chart isn&apos;t for
          children under 13.
        </span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-heat">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-volt py-3 tag font-bold text-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create Account"}
      </button>
    </form>
  );
}
