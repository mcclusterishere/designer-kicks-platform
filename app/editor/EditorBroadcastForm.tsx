"use client";

import { useActionState, useEffect } from "react";
import { editorBroadcast, draftCaptions, type BroadcastResult, type CaptionsResult } from "@/app/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

function ChannelChip({ name, result }: { name: string; result: { ok: boolean; detail: string } | null }) {
  if (result === null) {
    return (
      <span className="tag rounded-full border border-edge px-2.5 py-1 text-smoke" title="The office connects these channels">
        {name}: not connected
      </span>
    );
  }
  return (
    <span
      className={`tag rounded-full border px-2.5 py-1 ${result.ok ? "border-volt/60 text-volt" : "border-heat/60 text-heat"}`}
      title={result.detail}
    >
      {name}: {result.ok ? "posted ✓" : "failed"}
    </span>
  );
}

export default function EditorBroadcastForm() {
  const [state, formAction, pending] = useActionState<BroadcastResult | null, FormData>(
    editorBroadcast,
    null
  );
  const [draft, draftAction, drafting] = useActionState<CaptionsResult | null, FormData>(
    draftCaptions,
    null
  );

  // A fresh AI draft lands in the composer, ready to edit before posting.
  useEffect(() => {
    if (draft?.ok) {
      const box = document.getElementById("eb-body") as HTMLTextAreaElement | null;
      if (box) box.value = draft.post;
    }
  }, [draft]);

  return (
    <div className="space-y-4">
      {/* Blank-box killer: say what it's about, get captions to edit */}
      <form action={draftAction} className="rounded-xl border border-edge bg-panel/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="tag text-smoke" htmlFor="dc-about">Need words? Say what the post is about</label>
            <input id="dc-about" name="about" maxLength={400}
              placeholder="e.g. new artist page for Nova Kicks — sunset AF1s, link /artists/nova-kicks"
              className={inputClass} />
          </div>
          <button type="submit" disabled={drafting}
            className="rounded-lg border border-volt/60 bg-volt/10 px-4 py-2.5 tag font-bold text-volt disabled:opacity-50">
            {drafting ? "Writing…" : "✨ Draft it for me"}
          </button>
        </div>
        {draft && !draft.ok && <p className="mt-2 text-xs text-heat">{draft.error}</p>}
        {draft?.ok && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="tag text-smoke">Instagram version</p>
              <textarea readOnly rows={4} value={draft.instagram} onFocus={(e) => e.target.select()}
                className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 text-xs text-white" />
            </div>
            <div>
              <p className="tag text-smoke">X / short version</p>
              <textarea readOnly rows={4} value={draft.x} onFocus={(e) => e.target.select()}
                className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 text-xs text-white" />
            </div>
            <p className="text-xs text-smoke sm:col-span-2">
              The main caption is in the composer below — tweak it, add the photo, post.
            </p>
          </div>
        )}
      </form>

      <form action={formAction} className="space-y-3">
        <div>
          <label className="tag text-smoke" htmlFor="eb-body">The post *</label>
          <textarea id="eb-body" name="body" required maxLength={2200} rows={4}
            placeholder="What's moving on the chart today…" className={inputClass} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="tag text-smoke" htmlFor="eb-photo">Photo (needed for IG)</label>
            <input id="eb-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className={inputClass} />
          </div>
          <div>
            <label className="tag text-smoke" htmlFor="eb-link">Link (optional)</label>
            <input id="eb-link" name="linkUrl" placeholder="/drops or https://…" className={inputClass} />
          </div>
          <div>
            <label className="tag text-smoke" htmlFor="eb-label">Link label</label>
            <input id="eb-label" name="linkLabel" maxLength={40} placeholder='"See the bracket"' className={inputClass} />
          </div>
        </div>
        {state && !state.ok && <p className="text-sm text-heat">{state.error}</p>}
        <button type="submit" disabled={pending}
          className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-50">
          {pending ? "Posting…" : "Post to site + socials"}
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
          <textarea readOnly value={state.copyText} rows={3} onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-xs text-volt" />
        </div>
      )}
    </div>
  );
}
