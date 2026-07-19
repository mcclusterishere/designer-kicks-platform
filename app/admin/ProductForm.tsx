"use client";

import { useActionState } from "react";
import { saveProduct, type ActionResult } from "@/app/actions";

type Defaults = {
  id?: string;
  name?: string;
  merchant?: string;
  category?: string;
  blurb?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  affiliateUrl?: string;
  featured?: boolean;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function ProductForm({ defaults }: { defaults?: Defaults }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveProduct,
    null
  );
  const editing = Boolean(defaults?.id);

  return (
    <form action={formAction} className="space-y-4" key={defaults?.id ?? "new"}>
      {editing && <input type="hidden" name="id" value={defaults!.id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="p-name">Product / link name *</label>
          <input id="p-name" name="name" required defaultValue={defaults?.name} placeholder="e.g. Angelus Paint Starter Kit" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="p-merchant">Merchant *</label>
          <input id="p-merchant" name="merchant" required defaultValue={defaults?.merchant} placeholder="e.g. Angelus Direct" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="tag text-smoke" htmlFor="p-category">Category</label>
          <select id="p-category" name="category" defaultValue={defaults?.category ?? "accessories"} className={inputClass}>
            <option value="marketplace">Marketplace</option>
            <option value="retail">Retail</option>
            <option value="customization">Custom Supplies</option>
            <option value="cleaning">Care & Cleaning</option>
            <option value="accessories">Accessories</option>
          </select>
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="p-price">Price (display only)</label>
          <input id="p-price" name="price" defaultValue={defaults?.price ?? ""} placeholder="e.g. $39.99 or From $12" className={inputClass} />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-smoke">
            <input type="checkbox" name="featured" defaultChecked={defaults?.featured} className="h-4 w-4 accent-[#d9b96a]" />
            Featured on homepage
          </label>
        </div>
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="p-url">Affiliate link *</label>
        <input id="p-url" name="affiliateUrl" required defaultValue={defaults?.affiliateUrl} placeholder="https://…" className={inputClass} />
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="p-img">Image URL (optional)</label>
        <input id="p-img" name="imageUrl" defaultValue={defaults?.imageUrl ?? ""} placeholder="https://… (leave blank for merchant-name card)" className={inputClass} />
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="p-blurb">Blurb</label>
        <input id="p-blurb" name="blurb" defaultValue={defaults?.blurb ?? ""} maxLength={140} placeholder="One line on why it's heat" className={inputClass} />
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="text-sm text-volt">Saved.</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : editing ? "Update Product" : "Add Product"}
      </button>
    </form>
  );
}
