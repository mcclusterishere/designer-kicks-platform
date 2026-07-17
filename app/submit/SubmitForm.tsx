"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createSubmission, type ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function SubmitForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createSubmission,
    null
  );
  const [preview, setPreview] = useState<string | null>(null);

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-volt bg-surface p-8 text-center glow-volt">
        <p className="display text-3xl text-volt">You&apos;re in. 🔥</p>
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
          </label>
          <input
            id="artistName"
            name="artistName"
            required
            maxLength={60}
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
            placeholder="@yourhandle"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="tag text-smoke">
            Email * <span className="normal-case">(never shown publicly)</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="baseShoe" className="tag text-smoke">
            Base shoe *
          </label>
          <input
            id="baseShoe"
            name="baseShoe"
            required
            maxLength={60}
            placeholder="e.g. Air Force 1, Dunk Low, AJ1"
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
          Photo of the shoe *
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

      {state?.error && (
        <p className="rounded border border-heat/40 bg-heat/10 px-4 py-2 text-sm text-heat">
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
