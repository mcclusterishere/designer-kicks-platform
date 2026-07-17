"use client";

import { useState, useTransition } from "react";
import { claimSale } from "@/app/actions";

export default function ClaimSaleButton({ saleId }: { saleId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return <p className="tag text-volt">Claimed ✓ — it&apos;s in your closet.</p>;

  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await claimSale(saleId);
            if (res.ok) setDone(true);
            else setError(res.error ?? "Something went wrong.");
          })
        }
        className="tag rounded bg-volt px-4 py-2 font-bold text-ink disabled:opacity-50"
      >
        {pending ? "Claiming…" : "Claim This Piece"}
      </button>
      {error && <p className="mt-1 text-xs text-heat">{error}</p>}
    </div>
  );
}
