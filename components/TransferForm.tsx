"use client";

import { useActionState, useState } from "react";
import { transferOwnership } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

export default function TransferForm({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    transferOwnership,
    null
  );

  if (state?.ok) {
    return <p className="tag mt-2 text-volt">Transferred ✓ — it&apos;s in their closet.</p>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tag mt-2 rounded border border-edge px-3 py-1.5 text-smoke transition hover:border-volt hover:text-white"
      >
        Sold it? Transfer to buyer
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input
        name="buyerEmail"
        type="email"
        required
        placeholder="buyer's account email"
        className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
      />
      {state?.error && <p className="text-xs text-heat">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="tag w-full rounded bg-volt py-2 font-bold text-ink disabled:opacity-50"
      >
        {pending ? "Transferring…" : "Confirm Transfer"}
      </button>
    </form>
  );
}
