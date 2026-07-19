"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createSubmission, type ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none disabled:opacity-60";

type Props = {
  artistDefaults: { artistName: string; socialHandle: string; locked: boolean };
};

export default function SubmitForm({ artistDefaults }: Props) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createSubmission,
    null
  );
  const [preview, setPreview] = useState<string | null>(null);

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-volt bg-surface p-8 text-center glow-volt">
        <p className="display text-3xl text-volt">You&apos;re in.</p>
        <p className="mt-3 text-smoke">
          Your custom is in the review queue. Once it&apos;s approved it can be
          drafted into a battle — watch the{" "}
          <Link href="/battles" className="text-volt underline">
            arena
          </Link>{" "}
          and tell your people to vote.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="title" className="tag text-smoke">
          Name of the custom *
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={80}
          placeholder='e.g. "Toxic Drip AF1"'
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="artistName" className="tag text-smoke">
            Artist / crew name *
            {artistDefaults.locked && (
              <span className="normal-case"> (from your artist profile)</span>
            )}
          </label>
          <input
            id="artistName"
            name="artistName"
            required
            maxLength={60}
            defaultValue={artistDefaults.artistName}
            readOnly={artistDefaults.locked}
            placeholder="Who made it"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="socialHandle" className="tag text-smoke">
            Instagram / TikTok handle
          </label>
          <input
            id="socialHandle"
            name="socialHandle"
            maxLength={40}
            defaultValue={artistDefaults.socialHandle}
            readOnly={artistDefaults.locked}
            placeholder="@yourhandle"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="baseShoe" className="tag text-smoke">
            Base item *
          </label>
          <input
            id="baseShoe"
            name="baseShoe"
            required
            maxLength={60}
            placeholder="e.g. Air Force 1, hoodie blank, fitted cap"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="category" className="tag text-smoke">
            Category *
          </label>
          <select id="category" name="category" className={inputClass} defaultValue="sneakers">
            <option value="sneakers">Sneakers</option>
            <option value="apparel">Apparel (vests, jackets, tees)</option>
            <option value="accessories">Accessories (hats, chains, bags)</option>
          </select>
        </div>
        <div>
          <label htmlFor="size" className="tag text-smoke">
            Size <span className="normal-case">(buyers need this)</span>
          </label>
          <input
            id="size"
            name="size"
            maxLength={20}
            placeholder="US 10.5 / L / 7 3-8"
            className={inputClass}
          />
        </div>
      </div>

      {/* Taxonomy — optional, but it feeds the taste engine and gets
          the piece in front of the fans who vote for exactly this. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="brand" className="tag text-smoke">
            Brand
          </label>
          <input
            id="brand"
            name="brand"
            maxLength={40}
            placeholder="Jordan / Nike / adidas…"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="silhouette" className="tag text-smoke">
            Silhouette
          </label>
          <input
            id="silhouette"
            name="silhouette"
            maxLength={40}
            placeholder="e.g. Air Jordan 11, Dunk Low"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="baseColorway" className="tag text-smoke">
            Original colorway
          </label>
          <input
            id="baseColorway"
            name="baseColorway"
            maxLength={40}
            placeholder='what it was before — "Triple White"'
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="tag text-smoke">
          The story (technique, materials, inspiration)
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={600}
          placeholder="Angelus paints, hand-stitched panels, hydro-dipped soles…"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="image" className="tag text-smoke">
          Photo of the piece *
        </label>
        <input
          id="image"
          name="image"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
          className="mt-1 w-full rounded-lg border border-dashed border-edge bg-surface px-3 py-6 text-sm text-smoke file:mr-4 file:rounded file:border-0 file:bg-volt file:px-4 file:py-2 file:font-bold file:text-ink"
        />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Preview of your upload"
            className="mt-3 max-h-72 rounded-xl border border-edge object-contain"
          />
        )}
      </div>

      <div>
        <label htmlFor="morePhotos" className="tag text-smoke">
          More angles <span className="normal-case">(up to 4 — voters swipe through these)</span>
        </label>
        <input
          id="morePhotos"
          name="morePhotos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="mt-1 w-full rounded-lg border border-dashed border-edge bg-surface px-3 py-3 text-sm text-smoke file:mr-4 file:rounded file:border-0 file:bg-volt file:px-4 file:py-2 file:font-bold file:text-ink"
        />
      </div>

      {state?.error && (
        <p role="alert" className="rounded border border-heat/40 bg-heat/10 px-4 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-volt py-3.5 tag font-bold text-ink glow-volt transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Submit To The Arena"}
      </button>
    </form>
  );
}
