"use client";

import { useActionState } from "react";
import { artistFeedPost, deleteFeedPost, type ActionResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

type RecentPost = { id: string; body: string; ago: string; reactions: number; comments: number };

// The artist's mic: post straight into The Feed on the home page.
export default function StudioPostForm({ recent }: { recent: RecentPost[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    artistFeedPost,
    null
  );
  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <div>
          <label className="tag text-smoke" htmlFor="sp-body">Post to The Feed *</label>
          <textarea
            id="sp-body"
            name="body"
            required
            maxLength={2200}
            rows={3}
            placeholder="New build on the bench… work-in-progress shots… drop announcements…"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="tag text-smoke" htmlFor="sp-photo">Photo</label>
            <input id="sp-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className={inputClass} />
          </div>
          <div>
            <label className="tag text-smoke" htmlFor="sp-link">Link (optional)</label>
            <input id="sp-link" name="linkUrl" placeholder="your page, a battle, anywhere" className={inputClass} />
          </div>
        </div>
        {state?.ok && <p className="text-sm text-volt">Posted — it&apos;s live in The Feed ✓</p>}
        {state && !state.ok && <p className="text-sm text-heat">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </form>

      {recent.length > 0 && (
        <div>
          <p className="tag text-smoke">Your recent posts</p>
          <div className="mt-2 space-y-1.5">
            {recent.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-edge bg-surface px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-sm text-white">{p.body}</p>
                <span className="tag shrink-0 text-smoke">
                  🔥{p.reactions} · {p.comments} talk · {p.ago}
                </span>
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
