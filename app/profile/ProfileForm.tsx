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
  favoriteBrands: string;
  styleInterests: string;
  instagram: string;
  marketingOptIn: boolean;
  battleAlerts: boolean;
  shopFor: string;
  laneStrict: boolean;
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-brands" className="tag text-smoke">Favorite brands</label>
          <input id="p-brands" name="favoriteBrands" maxLength={120} defaultValue={defaults.favoriteBrands} placeholder="Jordan, Nike, New Balance" className={inputClass} />
        </div>
        <div>
          <label htmlFor="p-style" className="tag text-smoke">Style interests</label>
          <input id="p-style" name="styleInterests" maxLength={120} defaultValue={defaults.styleInterests} placeholder="Retro, Customs, Streetwear" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="p-shopfor" className="tag text-smoke">Who do you shop for?</label>
        <select id="p-shopfor" name="shopFor" defaultValue={defaults.shopFor} className={inputClass}>
          <option value="">Pick a lane…</option>
          <option value="mens">Men&apos;s</option>
          <option value="womens">Women&apos;s</option>
          <option value="kids">Kids</option>
          <option value="all">Show me everything</option>
        </select>
        <p className="mt-1 text-xs text-smoke/70">
          Who you shop <em>for</em> — yourself, your partner, whoever. We deal
          about two-thirds from your lane and sprinkle in wild cards from the
          rest, so you never miss heat. Flip lanes any time.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-smoke">
        <input type="checkbox" name="laneStrict" defaultChecked={defaults.laneStrict} className="h-4 w-4 accent-[#f04e45]" />
        Only my lane — skip the wild cards
      </label>
      <label className="flex items-center gap-2 text-sm text-smoke">
        <input type="checkbox" name="battleAlerts" defaultChecked={defaults.battleAlerts} className="h-4 w-4 accent-[#f04e45]" />
        Email me the moment a battle goes live
      </label>
      <label className="flex items-center gap-2 text-sm text-smoke">
        <input type="checkbox" name="marketingOptIn" defaultChecked={defaults.marketingOptIn} className="h-4 w-4 accent-[#f04e45]" />
        Text/email me about drops, battles, and giveaways
      </label>
      {state?.error && <p className="text-sm text-heat" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-volt">Saved.</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg btn-hard px-6 py-3 tag font-bold disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save Profile"}
      </button>
    </form>
  );
}
