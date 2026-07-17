"use client";

import { useActionState } from "react";
import { applyForArtist } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

type Defaults = {
  displayName?: string;
  instagram?: string | null;
  city?: string | null;
  portfolioUrl?: string | null;
  bio?: string | null;
};

export default function ApplyForm({ defaults }: { defaults?: Defaults }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    applyForArtist,
    null
  );

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-volt bg-surface p-8 text-center glow-volt">
        <p className="display text-3xl text-volt">Application In 🎨</p>
        <p className="mt-3 text-smoke">
          We review every artist by hand — you&apos;ll see your status here,
          and once you&apos;re approved you can submit customs and build your
          league record.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="a-name" className="tag text-smoke">Artist / crew name *</label>
          <input id="a-name" name="displayName" required maxLength={60}
            defaultValue={defaults?.displayName} placeholder="Who makes the heat" className={inputClass} />
        </div>
        <div>
          <label htmlFor="a-ig" className="tag text-smoke">Instagram / TikTok</label>
          <input id="a-ig" name="instagram" maxLength={40}
            defaultValue={defaults?.instagram ?? ""} placeholder="@yourwork" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="a-city" className="tag text-smoke">City</label>
          <input id="a-city" name="city" maxLength={60}
            defaultValue={defaults?.city ?? ""} placeholder="Atlanta, GA" className={inputClass} />
        </div>
        <div>
          <label htmlFor="a-url" className="tag text-smoke">Portfolio link</label>
          <input id="a-url" name="portfolioUrl" maxLength={200}
            defaultValue={defaults?.portfolioUrl ?? ""} placeholder="https://instagram.com/yourwork" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="a-bio" className="tag text-smoke">About your work</label>
        <textarea id="a-bio" name="bio" rows={3} maxLength={400}
          defaultValue={defaults?.bio ?? ""}
          placeholder="How long you've been customizing, techniques, notable pieces…" className={inputClass} />
      </div>
      {state?.error && (
        <p className="rounded border border-heat/40 bg-heat/10 px-4 py-2 text-sm text-heat">{state.error}</p>
      )}
      <button type="submit" disabled={pending}
        className="w-full rounded-lg bg-heat py-3.5 tag font-bold text-white glow-heat disabled:opacity-50">
        {pending ? "Sending…" : "Apply For An Artist Account"}
      </button>
      <p className="text-xs text-smoke">
        Fan accounts are instant — artist accounts are reviewed because
        artists will eventually sell and get paid through the platform.
      </p>
    </form>
  );
}
