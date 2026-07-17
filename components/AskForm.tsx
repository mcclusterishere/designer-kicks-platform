"use client";

import { useActionState } from "react";
import { setAskingPrice } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

export default function AskForm({
  submissionId,
  currentAskCents,
}: {
  submissionId: string;
  currentAskCents: number | null;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setAskingPrice,
    null
  );

  return (
    <form action={formAction} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input
        name="price"
        inputMode="decimal"
        defaultValue={currentAskCents ? String(currentAskCents / 100) : ""}
        placeholder="ask $ (blank = delist)"
        className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="tag shrink-0 rounded bg-heat px-3 py-2 font-bold text-white disabled:opacity-50"
      >
        {pending ? "…" : state?.ok ? "Saved ✓" : "Set Ask"}
      </button>
      {state?.error && <span className="text-xs text-heat">{state.error}</span>}
    </form>
  );
}
