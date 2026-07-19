"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { preloadArtist, analyzeShoePhotos, type PreloadResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function PreloadArtistForm({ homeHref = "/admin" }: { homeHref?: string }) {
  const [state, formAction, pending] = useActionState<PreloadResult | null, FormData>(
    preloadArtist,
    null
  );
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [aiPending, startAi] = useTransition();

  // Photos → filled fields. Only ever fills EMPTY fields, so nothing the
  // editor already typed gets stomped.
  function autofillFromPhotos() {
    setAiMsg(null);
    startAi(async () => {
      const fd = new FormData();
      const cover = (document.getElementById("pl-img") as HTMLInputElement | null)?.files;
      const more = (document.getElementById("pl-more") as HTMLInputElement | null)?.files;
      if (cover) Array.from(cover).forEach((f) => fd.append("image", f));
      if (more) Array.from(more).forEach((f) => fd.append("morePhotos", f));
      const res = await analyzeShoePhotos(fd);
      if (!res.ok) {
        setAiMsg(res.error);
        return;
      }
      const fill = (id: string, v: string | null) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el && v && !el.value.trim()) el.value = v;
      };
      fill("pl-title", res.draft.title);
      fill("pl-base", res.draft.baseShoe);
      fill("pl-brand", res.draft.brand);
      fill("pl-sil", res.draft.silhouette);
      fill("pl-cw", res.draft.baseColorway);
      fill("pl-desc", res.draft.description);
      if (res.draft.category) {
        const sel = document.getElementById("pl-cat") as HTMLSelectElement | null;
        if (sel) sel.value = res.draft.category;
      }
      setAiMsg("Filled in what the photos show — give it a once-over before staging.");
    });
  }

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-volt/50 bg-volt/10 p-3 text-sm text-volt">
          {state.alreadyClaimed ? "New piece added to their page" : "Artist is live"} —{" "}
          <Link href={`/artists/${state.artistSlug}`} className="underline">
            view their page
          </Link>
          . Their piece is approved and battle-ready.
          {state.emailSent && " Notification email sent automatically. ✉️"}
        </p>
        {state.claimUrl ? (
          <div>
            <p className="tag text-smoke">Claim link (valid 14 days — sets their password)</p>
            <input
              readOnly
              value={state.claimUrl}
              onFocus={(e) => e.target.select()}
              className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-xs text-volt"
            />
            <p className="tag mt-1 text-smoke">
              Loading more pieces for this artist keeps this same link working.
            </p>
          </div>
        ) : (
          <p className="rounded-lg border border-edge bg-panel p-3 text-sm text-smoke">
            This artist already claimed their account — no claim link needed,
            the piece is on their page now.
          </p>
        )}
        <div>
          <p className="tag text-smoke">
            Copy-paste outreach DM {state.emailSent ? "(email already sent — use this for IG)" : ""}
          </p>
          <textarea
            readOnly
            rows={8}
            value={state.inviteText}
            onFocus={(e) => e.target.select()}
            className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white"
          />
        </div>
        <a href={homeHref} className="tag inline-block rounded border border-edge px-4 py-2 text-white hover:border-volt">
          Pre-load another artist
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="pl-name">Artist / crew name *</label>
          <input id="pl-name" name="artistName" required maxLength={60} placeholder="Krylon Kelz" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="pl-email">Artist email * (their claimable account)</label>
          <input id="pl-email" name="email" type="email" required placeholder="artist@email.com" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="pl-ig">Instagram</label>
          <input id="pl-ig" name="instagram" maxLength={40} placeholder="@theirwork" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="pl-city">City</label>
          <input id="pl-city" name="city" maxLength={60} placeholder="Atlanta, GA" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="pl-title">Piece title *</label>
          <input id="pl-title" name="shoeTitle" required maxLength={80} placeholder='"Toxic Drip AF1"' className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="pl-base">Base item *</label>
          <input id="pl-base" name="baseShoe" required maxLength={60} placeholder="Air Force 1" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="pl-cat">Category</label>
          <select id="pl-cat" name="category" defaultValue="sneakers" className={inputClass}>
            <option value="sneakers">👟 Sneakers</option>
            <option value="apparel">🧥 Apparel</option>
            <option value="accessories">🧢 Accessories</option>
          </select>
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="pl-size">Size (if it&apos;s a sized piece)</label>
          <input id="pl-size" name="size" maxLength={20} placeholder="US 10.5 / L" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="tag text-smoke" htmlFor="pl-brand">Brand</label>
          <input id="pl-brand" name="brand" maxLength={40} placeholder="Jordan" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="pl-sil">Silhouette</label>
          <input id="pl-sil" name="silhouette" maxLength={40} placeholder="Air Jordan 11" className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="pl-cw">Original colorway</label>
          <input id="pl-cw" name="baseColorway" maxLength={40} placeholder='"Bred"' className={inputClass} />
        </div>
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="pl-desc">The story (optional)</label>
        <input id="pl-desc" name="description" maxLength={600} placeholder="Technique, materials, inspiration" className={inputClass} />
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="pl-img">Photo * (use their photo with permission)</label>
        <input id="pl-img" name="image" type="file" required accept="image/jpeg,image/png,image/webp"
          className="mt-1 w-full rounded-lg border border-dashed border-edge bg-surface px-3 py-4 text-sm text-smoke file:mr-4 file:rounded file:border-0 file:bg-volt file:px-4 file:py-2 file:font-bold file:text-ink" />
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="pl-more">More angles (up to 5 — 5–6 photos total, voters swipe through these)</label>
        <input id="pl-more" name="morePhotos" type="file" multiple accept="image/jpeg,image/png,image/webp"
          className="mt-1 w-full rounded-lg border border-dashed border-edge bg-surface px-3 py-3 text-sm text-smoke file:mr-4 file:rounded file:border-0 file:bg-volt file:px-4 file:py-2 file:font-bold file:text-ink" />
      </div>
      <div className="rounded-lg border border-edge bg-panel/40 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={autofillFromPhotos} disabled={aiPending}
            className="rounded-lg border border-volt/60 bg-volt/10 px-4 py-2 tag font-bold text-volt disabled:opacity-50">
            {aiPending ? "Looking at the photos…" : "✨ Fill details from the photos"}
          </button>
          <p className="text-xs text-smoke">
            Pick the photos above first — the AI works out the shoe, brand, and colorway so you just review.
          </p>
        </div>
        {aiMsg && <p className="mt-2 text-xs text-volt">{aiMsg}</p>}
      </div>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-50">
        {pending ? "Creating…" : "Pre-load Artist + Piece"}
      </button>
    </form>
  );
}
