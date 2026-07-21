"use client";

import { useActionState, useState } from "react";
import { createConsignment } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

const field =
  "w-full min-w-0 rounded-md border border-edge bg-surface px-2.5 py-2 text-sm tabular-nums text-white placeholder:text-smoke/60 focus:border-volt focus:outline-none";

/**
 * The relist terminal for a piece that came back home. Everything on
 * this form becomes DISCLOSED market data — the prior price shows on
 * the piece's record, the split shows in the sale note, the floor
 * shows on the board. Typing the prior sale auto-suggests a 2× floor;
 * the artist can set whatever floor they want.
 */
export default function ConsignForm({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false);
  const [floor, setFloor] = useState("");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createConsignment,
    null
  );

  if (state?.ok) {
    return (
      <p className="tag mt-2 rounded border border-heat/50 bg-heat/10 px-3 py-2 text-heat">
        Consignment open ✓ — the piece is back on the board with its history disclosed.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tag mt-2 w-full rounded-md border border-heat/60 py-2.5 font-bold text-heat transition hover:bg-heat/10"
      >
        Relist as Consignment
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2 rounded-md border border-heat/40 bg-heat/5 p-2.5">
      <input type="hidden" name="submissionId" value={submissionId} />
      <p className="text-xs leading-relaxed text-smoke">
        A piece you sold, back in your hands to resell for the collector.
        The prior price, split, and floor all go on the public record —
        that disclosure is what makes the resale price count as real
        market evidence.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <input
          name="priorSale"
          inputMode="numeric"
          placeholder="sold before at $"
          aria-label="Prior sale price in dollars"
          onChange={(e) => {
            const v = Number(e.target.value.replace(/[$,\s]/g, ""));
            if (Number.isFinite(v) && v > 0 && !floor) setFloor(String(v * 2));
          }}
          className={field}
        />
        <input
          name="floor"
          required
          inputMode="numeric"
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          placeholder="bid floor $"
          aria-label="Bid floor in dollars"
          className={field}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input
          name="split"
          inputMode="numeric"
          defaultValue="75"
          aria-label="Consignor's share of the resale, percent"
          className={field}
        />
        <input
          name="consignorName"
          placeholder="consignor (private)"
          aria-label="Consignor name, kept private"
          className={field}
        />
      </div>
      <p className="text-[11px] text-smoke/70">
        Split = the consignor&apos;s share of the resale (default 75%).
        Their name stays private — the board shows &quot;a private collector.&quot;
      </p>
      <button
        type="submit"
        disabled={pending}
        className="tag w-full rounded-md btn-hard py-2.5 font-bold disabled:opacity-50"
      >
        {pending ? "Opening…" : "Open Consignment"}
      </button>
      {state?.error && <p role="alert" className="text-xs text-heat">{state.error}</p>}
    </form>
  );
}
