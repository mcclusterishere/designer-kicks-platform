"use client";

import { useActionState } from "react";
import { addArtistShop, type ActionResult } from "@/app/actions";
import { SELL_PLATFORMS } from "@/lib/sellPlatforms";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function AddShopForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addArtistShop,
    null
  );

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
      <div>
        <label className="tag text-smoke" htmlFor="shop-platform">Platform</label>
        <select id="shop-platform" name="platform" required defaultValue="" className={inputClass}>
          <option value="" disabled>Pick…</option>
          {SELL_PLATFORMS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="shop-url">Link to your store / profile</label>
        <input id="shop-url" name="url" required maxLength={400} placeholder="https://…" className={inputClass} />
      </div>
      <button type="submit" disabled={pending}
        className="h-[42px] rounded-lg btn-hard px-5 tag font-bold disabled:opacity-50">
        {pending ? "Adding…" : "Add shop"}
      </button>
      {state?.error && <p className="text-sm text-heat sm:col-span-3">{state.error}</p>}
      {state?.ok && <p className="text-sm text-volt sm:col-span-3">{state.note}</p>}
    </form>
  );
}
