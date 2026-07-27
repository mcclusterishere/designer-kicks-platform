"use client";

import { useActionState } from "react";
import { updateArtistProfile, type ActionResult } from "@/app/actions";

const field =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

/**
 * Your page, yours to edit. Name and URL stay fixed — the Heat List record
 * and every link people already have point at those — but the story, the
 * city, the socials and the photo are all yours to change anytime.
 */
export default function ProfileEditForm({
  current,
}: {
  current: {
    bio: string | null;
    city: string | null;
    instagram: string | null;
    portfolioUrl: string | null;
    avatarUrl: string | null;
  };
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateArtistProfile,
    null
  );

  return (
    <form action={action}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="shrink-0">
          <p className="tag text-smoke">Profile photo</p>
          {current.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.avatarUrl}
              alt="Your profile"
              className="mt-1 h-20 w-20 rounded-full border border-edge object-cover"
            />
          ) : (
            <div className="mt-1 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-edge text-2xl text-smoke">
              ◉
            </div>
          )}
          <input
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="mt-2 w-40 text-xs text-smoke file:mr-2 file:rounded file:border-0 file:bg-panel file:px-2 file:py-1 file:text-xs file:text-white"
          />
        </div>

        <div className="min-w-[240px] flex-1">
          <label className="tag text-smoke" htmlFor="pe-bio">Your story</label>
          <textarea
            id="pe-bio"
            name="bio"
            rows={4}
            maxLength={1000}
            defaultValue={current.bio ?? ""}
            placeholder="How you got into it, what you're known for, what you won't do…"
            className={field}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="tag text-smoke" htmlFor="pe-city">City</label>
          <input id="pe-city" name="city" maxLength={80} defaultValue={current.city ?? ""} placeholder="Atlanta, GA" className={field} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="pe-ig">Instagram</label>
          <input id="pe-ig" name="instagram" maxLength={60} defaultValue={current.instagram ?? ""} placeholder="yourhandle" className={field} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="pe-url">Portfolio / site</label>
          <input id="pe-url" name="portfolioUrl" maxLength={300} defaultValue={current.portfolioUrl ?? ""} placeholder="yoursite.com" className={field} />
        </div>
      </div>

      {state && !state.ok && <p className="mt-3 text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-sm text-volt">{state.note}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save page"}
      </button>
    </form>
  );
}
