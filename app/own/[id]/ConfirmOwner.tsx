"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmOwnershipAction, type ActionResult } from "@/app/actions";

/**
 * Confirming needs an account, because the whole point is a collector
 * page and a closet — both of which need somewhere to live. But the
 * sign-in prompt comes AFTER they've seen the piece, not before, so
 * nobody is asked to register for something they can't see yet.
 */
export default function ConfirmOwner({
  submissionId,
  signedIn,
}: {
  submissionId: string;
  signedIn: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    confirmOwnershipAction,
    null
  );

  if (!signedIn) {
    return (
      <div className="rounded-xl border border-volt/50 bg-volt/5 p-5 text-center">
        <p className="text-sm text-white">Sign in and it&apos;s yours in one tap.</p>
        <p className="mt-1 text-xs text-smoke">
          Free. The piece lands in your closet with the provenance attached.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            href={`/signin?next=/own/${submissionId}`}
            className="rounded-lg btn-hard px-5 py-2.5 tag font-bold"
          >
            Sign in
          </Link>
          <Link
            href={`/register?next=/own/${submissionId}`}
            className="rounded-lg border border-edge px-5 py-2.5 tag font-bold text-white transition hover:border-volt"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="submissionId" value={submissionId} />
      {state && !state.ok && (
        <p role="alert" className="mb-3 rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="w-full rounded-lg btn-hard py-3.5 tag font-bold disabled:opacity-50"
      >
        {pending ? "Confirming…" : "Yes — this is mine"}
      </button>
    </form>
  );
}
