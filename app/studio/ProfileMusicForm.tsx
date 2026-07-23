"use client";

import { useActionState } from "react";
import { setArtistMusic, type ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

/**
 * "Your music" — paste a Spotify (or DistroKid / Apple Music) link and it
 * plays right on your league page. Prefilled with whatever's saved; blank
 * it out and save to remove.
 */
export default function ProfileMusicForm({ current }: { current: string | null }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setArtistMusic,
    null
  );

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <div>
        <label className="tag text-smoke" htmlFor="music-url">
          Spotify, DistroKid or Apple Music link
        </label>
        <input
          id="music-url"
          name="spotifyUrl"
          maxLength={400}
          defaultValue={current ?? ""}
          placeholder="https://open.spotify.com/artist/…"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs font-medium text-smoke">
          Spotify links get a real player on your page. Other links show a
          "Listen" button. Leave blank and save to remove.
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-[42px] rounded-lg btn-hard px-5 tag font-bold disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save music"}
      </button>
      {state?.error && <p className="text-sm text-heat sm:col-span-2">{state.error}</p>}
      {state?.ok && <p className="text-sm text-volt sm:col-span-2">{state.note}</p>}
    </form>
  );
}
