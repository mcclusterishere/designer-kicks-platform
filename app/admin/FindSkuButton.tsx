"use client";

import { useActionState } from "react";
import { lookupSkuForArticle, type ActionResult } from "@/app/actions";

export default function FindSkuButton({ articleId }: { articleId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async () => lookupSkuForArticle(articleId),
    null
  );
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-edge px-3 py-1.5 tag text-smoke hover:border-volt hover:text-white disabled:opacity-40"
      >
        {pending ? "Looking…" : "Find code"}
      </button>
      {state?.error && <span className="tag text-heat">{state.error}</span>}
      {state?.ok && state.note && <span className="tag text-volt">{state.note}</span>}
    </form>
  );
}
