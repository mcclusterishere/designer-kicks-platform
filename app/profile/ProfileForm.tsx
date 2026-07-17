"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/account-actions";
import type { ActionResult } from "@/app/actions";

type Defaults = {
  name: string;
  phone: string;
  city: string;
  shoeSize: string;
  favoriteSilhouette: string;
  instagram: string;
  marketingOptIn: boolean;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function ProfileForm({ defaults }: { defaults: Defaults }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateProfile,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-name" className="tag text-smoke">Name *</label>
          <input id="p-name" name="name" required maxLength={60} defaultValue={defaults.name} className={inputClass} />
        </div>
        <div>
          <label htmlFor="p-phone" className="tag text-smoke">Phone</label>
          <input id="p-phone" name="phone" type="tel" maxLength={30} defaultValue={defaults.phone} placeholder="+1 (555) 555-5555" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-city" className="tag text-smoke">City</label>
          <input id="p-city" name="city" maxLength={60} defaultValue={defaults.city} placeholder="Atlanta, GA" className={inputClass} />
        </div>
        <div>
          <label htmlFor="p-size" className="tag text-smoke">Shoe size</label>
          <input id="p-size" name="shoeSize" maxLength={10} defaultValue={defaults.shoeSize} placeholder="10.5" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-fav" className="tag text-smoke">Favorite silhouette</label>
          <input id="p-fav" name="favoriteSilhouette" maxLength={60} defaultValue={defaults.favoriteSilhouette} placeholder="Air Jordan 4" className={inputClass} />
        </div>
        <div>
          <label htmlFor="p-ig" className="tag text-smoke">Instagram</label>
          <input id="p-ig" name="instagram" maxLength={40} defaultValue={defaults.instagram} placeholder="@yourhandle" className={inputClass} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-smoke">
        <input type="checkbox" name="marketingOptIn" defaultChecked={defaults.marketingOptIn} className="h-4 w-4 accent-[#c8ff00]" />
        Text/email me about drops, battles, and giveaways
      </label>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="text-sm text-volt">Saved.</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-volt px-6 py-3 tag font-bold text-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save Profile"}
      </button>
    </form>
  );
}
