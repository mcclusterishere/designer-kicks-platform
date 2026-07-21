"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { loginUser } from "@/app/account-actions";
import type { ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function LoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    loginUser,
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
        <label htmlFor="email" className="tag text-smoke">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="tag text-smoke">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </div>
      {state?.error && <p className="text-sm text-heat" role="alert">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg btn-hard py-3 tag font-bold disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
