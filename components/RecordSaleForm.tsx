"use client";

import { useActionState, useState } from "react";
import { recordSale } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

const inputClass =
  "w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function RecordSaleForm({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    recordSale,
    null
  );

  if (state?.ok) {
    return (
      <p className="tag mt-2 text-heat">
        ⏳ Sale recorded — pending the buyer&apos;s claim.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tag mt-2 rounded border border-edge px-3 py-1.5 text-smoke transition hover:border-volt hover:text-white"
      >
        Sold it? Record the sale
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input name="buyerEmail" type="email" required placeholder="buyer's email" className={inputClass} />
      <div className="flex gap-2">
        <input name="price" required inputMode="decimal" placeholder="price $" className={inputClass} />
        <input name="soldAt" type="date" className={inputClass} />
      </div>
      <div>
        <label className="tag text-smoke">Evidence (receipt / payment screenshot — earns the ✓)</label>
        <input
          name="evidence"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-1 w-full rounded-lg border border-dashed border-edge bg-panel px-2 py-2 text-xs text-smoke file:mr-2 file:rounded file:border-0 file:btn-hard file:px-2 file:py-1 file:text-xs file:font-bold file:text-ink"
        />
      </div>
      {state?.error && <p className="text-xs text-heat">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="tag w-full rounded btn-hard py-2 font-bold disabled:opacity-50"
      >
        {pending ? "Recording…" : "Record Sale (buyer claims it)"}
      </button>
    </form>
  );
}
