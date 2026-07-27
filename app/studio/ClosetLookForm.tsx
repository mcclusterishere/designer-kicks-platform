"use client";

import { useActionState, useState } from "react";
import { updateClosetLook, type ActionResult } from "@/app/actions";

const field =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

/**
 * How your room is hung.
 *
 * A portfolio where every maker's work is dealt in upload order flattens
 * the difference between makers, and the difference is the whole point of
 * the site — so this is the layer that lets a page look like whoever built
 * it. Lead piece, headline, accent, and how the wall hangs.
 */
export default function ClosetLookForm({
  current,
  pieces,
}: {
  current: {
    closetHeadline: string | null;
    featuredSubmissionId: string | null;
    accentColor: string | null;
    closetLayout: string;
  };
  pieces: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateClosetLook, null);
  const [accent, setAccent] = useState(current.accentColor ?? "");

  return (
    <form action={action}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="tag text-smoke" htmlFor="cl-headline">Headline over your work</label>
          <input
            id="cl-headline"
            name="closetHeadline"
            maxLength={120}
            defaultValue={current.closetHeadline ?? ""}
            placeholder="Hand-painted one-of-ones out of Atlanta"
            className={field}
          />
        </div>

        <div>
          <label className="tag text-smoke" htmlFor="cl-feature">Lead with</label>
          <select
            id="cl-feature"
            name="featuredSubmissionId"
            defaultValue={current.featuredSubmissionId ?? ""}
            className={field}
          >
            <option value="">Newest piece (default)</option>
            {pieces.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="tag text-smoke" htmlFor="cl-layout">How it hangs</label>
          <select id="cl-layout" name="closetLayout" defaultValue={current.closetLayout} className={field}>
            <option value="grid">Grid — even tiles</option>
            <option value="gallery">Gallery — big lead, smaller rest</option>
            <option value="list">List — one across, room to read</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="tag text-smoke" htmlFor="cl-accent">Your colour</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={accent || "#f04e45"}
              onChange={(e) => setAccent(e.target.value)}
              aria-label="Pick your accent colour"
              className="h-10 w-12 shrink-0 cursor-pointer rounded border border-edge bg-surface"
            />
            <input
              id="cl-accent"
              name="accentColor"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              maxLength={7}
              placeholder="#f04e45 — blank for the house look"
              className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
            />
            {accent && (
              <button
                type="button"
                onClick={() => setAccent("")}
                className="shrink-0 rounded border border-edge px-3 py-2 tag text-smoke hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {state && !state.ok && <p className="mt-3 text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-sm text-volt">{state.note}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save closet look"}
      </button>
    </form>
  );
}
