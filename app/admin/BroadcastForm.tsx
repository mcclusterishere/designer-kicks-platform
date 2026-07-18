"use client";

import { useActionState } from "react";
import { broadcastPost, deleteFeedPost, type BroadcastResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

type RecentPost = { id: string; body: string; pinned: boolean; ago: string };

function ChannelChip({ name, result }: { name: string; result: { ok: boolean; detail: string } | null }) {
  if (result === null) {
    return (
      <span className="tag rounded-full border border-edge px-2.5 py-1 text-smoke" title="Add the token in Railway to auto-post">
        {name}: not connected
      </span>
    );
  }
  return (
    <span
      className={`tag rounded-full border px-2.5 py-1 ${
        result.ok ? "border-volt/60 text-volt" : "border-heat/60 text-heat"
      }`}
      title={result.detail}
    >
      {name}: {result.ok ? "posted ✓" : "failed"}
    </span>
  );
}

export default function BroadcastForm({ recent }: { recent: RecentPost[] }) {
  const [state, formAction, pending] = useActionState<BroadcastResult | null, FormData>(
    broadcastPost,
    null
  );

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <div>
          <label className="tag text-smoke" htmlFor="bc-body">The post *</label>
          <textarea
            id="bc-body"
            name="body"
            required
            maxLength={2200}
            rows={4}
            placeholder="What's moving on the chart today…"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="tag text-smoke" htmlFor="bc-photo">Photo (needed for IG)</label>
            <input id="bc-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className={inputClass} />
          </div>
          <div>
            <label className="tag text-smoke" htmlFor="bc-link">Link (optional)</label>
            <input id="bc-link" name="linkUrl" placeholder="/drops or https://…" className={inputClass} />
          </div>
          <div>
            <label className="tag text-smoke" htmlFor="bc-label">Link label</label>
            <input id="bc-label" name="linkLabel" maxLength={40} placeholder='"See the bracket"' className={inputClass} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-smoke">
          <input type="checkbox" name="pinned" className="h-4 w-4 accent-[#c8ff00]" />
          Pin to the top of The Feed
        </label>
        {state && !state.ok && <p className="text-sm text-heat">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-50"
        >
          {pending ? "Broadcasting…" : "Broadcast"}
        </button>
      </form>

      {state?.ok && (
        <div className="space-y-2 rounded-xl border border-volt/40 bg-surface p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="tag rounded-full border border-volt px-2.5 py-1 text-volt">Feed: posted ✓</span>
            <ChannelChip name="Facebook" result={state.facebook} />
            <ChannelChip name="Instagram" result={state.instagram} />
          </div>
          <p className="tag text-smoke">Paste-ready for X / TikTok / anywhere else:</p>
          <textarea
            readOnly
            value={state.copyText}
            rows={3}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-xs text-volt"
          />
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <p className="tag text-smoke">Recent posts</p>
          <div className="mt-2 space-y-1.5">
            {recent.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-edge bg-surface px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-sm text-white">
                  {p.pinned && <span className="tag mr-1.5 text-volt">pinned</span>}
                  {p.body}
                </p>
                <span className="tag shrink-0 text-smoke">{p.ago}</span>
                <form action={deleteFeedPost.bind(null, p.id)}>
                  <button className="tag text-heat underline" aria-label={`Delete post: ${p.body.slice(0, 40)}`}>
                    delete
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
