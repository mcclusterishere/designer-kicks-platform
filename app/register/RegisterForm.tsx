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

  useEffect(() => {
    if (state?.ok) {
      router.push("/profile");
      router.refresh();
    }
  }, [state?.ok, router]);

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
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
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
