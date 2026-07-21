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
  const [videoCheck, setVideoCheck] = useState<
    { status: "ok"; seconds: number } | { status: "bad"; message: string } | null
  >(null);

  // The 15-second rule, enforced where the duration is actually knowable:
  // the browser reads the clip's metadata before it ever leaves the phone.
  // (The server can't probe duration — it backstops with a 40MB cap.)
  // A little headroom past 15 because phone encoders round up.
  function checkVideo(input: HTMLInputElement) {
    const f = input.files?.[0];
    if (!f) {
      setVideoCheck(null);
      return;
    }
    if (f.size > 40 * 1024 * 1024) {
      input.value = "";
      setVideoCheck({ status: "bad", message: "That file is over 40MB. Trim or compress it — 15 seconds should land well under that." });
      return;
    }
    const url = URL.createObjectURL(f);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (probe.duration > 16) {
        input.value = "";
        setVideoCheck({
          status: "bad",
          message: `That clip runs ${Math.round(probe.duration)}s — the limit is 15. Short hits harder anyway: one slow pan, done.`,
        });
      } else {
        setVideoCheck({ status: "ok", seconds: Math.round(probe.duration) });
      }
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      input.value = "";
      setVideoCheck({ status: "bad", message: "Couldn't read that video. Use an MP4, MOV, or WebM." });
    };
    probe.src = url;
  }

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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="askingPrice" className="tag text-smoke">
            Asking price <span className="normal-case">(USD — lists it on the Market)</span>
          </label>
          <input
            id="askingPrice"
            name="askingPrice"
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            step={1}
            placeholder="e.g. 450"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-smoke/70">
            The Market runs on real numbers — price your work. You can
            change it any time from your studio.
          </p>
        </div>
        <div>
          <label htmlFor="collabWith" className="tag text-smoke">
            Collab piece? <span className="normal-case">(co-artist&apos;s name or @handle)</span>
          </label>
          <input
            id="collabWith"
            name="collabWith"
            maxLength={120}
            placeholder="e.g. Justin Dekota, @dekota_customz"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-smoke/70">
            Built it with another artist on the chart? Tag them — the piece
            carries both names and shows on both pages.
          </p>
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
          className="mt-1 w-full rounded-lg border border-dashed border-edge bg-surface px-3 py-6 text-sm text-smoke file:mr-4 file:rounded file:border-0 file:btn-hard file:px-4 file:py-2 file:font-bold file:text-ink"
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
          className="mt-1 w-full rounded-lg border border-dashed border-edge bg-surface px-3 py-3 text-sm text-smoke file:mr-4 file:rounded file:border-0 file:btn-hard file:px-4 file:py-2 file:font-bold file:text-ink"
        />
      </div>

      <div>
        <label htmlFor="video" className="tag text-smoke">
          Video <span className="normal-case">(optional — 15 seconds max, one video a day)</span>
        </label>
        <input
          id="video"
          name="video"
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          onChange={(e) => checkVideo(e.currentTarget)}
          className="mt-1 w-full rounded-lg border border-dashed border-edge bg-surface px-3 py-3 text-sm text-smoke file:mr-4 file:rounded file:border-0 file:btn-hard file:px-4 file:py-2 file:font-bold file:text-ink"
        />
        <p className="mt-1.5 text-xs text-smoke/70">
          15 seconds is the sweet spot — one slow pan of the piece. Clips go
          out with the piece when it hits the chart.
        </p>
        {videoCheck?.status === "ok" && (
          <p className="mt-1 text-xs text-volt">
            Clip looks good — {videoCheck.seconds}s.
          </p>
        )}
        {videoCheck?.status === "bad" && (
          <p role="alert" className="mt-1 rounded border border-heat/40 bg-heat/10 px-3 py-2 text-xs text-heat">
            {videoCheck.message}
          </p>
        )}
      </div>

      {state?.error && (
        <p role="alert" className="rounded border border-heat/40 bg-heat/10 px-4 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg btn-hard py-3.5 tag font-bold glow-volt transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Submit To The Arena"}
      </button>
    </form>
  );
}
