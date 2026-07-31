"use client";

import { useActionState, useState } from "react";
import { groupShareAction } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

/**
 * One group in the run: copy the tagged caption, open the group, tick
 * it off. Built for a thumb — the whole loop is two taps and a paste.
 */
export default function GroupRunRow({
  groupId,
  groupName,
  groupUrl,
  postTitle,
  postUrl,
  caption,
  done,
}: {
  groupId: string;
  groupName: string;
  groupUrl: string | null;
  postTitle: string;
  postUrl: string;
  caption: string;
  done: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    groupShareAction,
    null
  );
  const [copied, setCopied] = useState(false);
  const isDone = state?.ok ? !done : done; // action toggles

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 ${
        isDone ? "border-volt/40 bg-volt/5" : "border-edge"
      }`}
    >
      <span className="min-w-0 flex-1 text-sm text-white">
        {isDone && <span className="mr-1 text-volt">✓</span>}
        {groupName}
      </span>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(caption).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-lg btn-hard px-3 py-1.5 tag font-bold"
        >
          {copied ? "Copied ✓" : "Copy caption"}
        </button>
        {groupUrl && (
          <a
            href={groupUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-edge px-3 py-1.5 tag text-smoke transition hover:text-white"
          >
            Open ↗
          </a>
        )}
        <form action={formAction}>
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="postUrl" value={postUrl} />
          <input type="hidden" name="postTitle" value={postTitle} />
          <button
            disabled={pending}
            className="rounded-lg border border-edge px-3 py-1.5 tag text-smoke transition hover:text-volt disabled:opacity-50"
          >
            {isDone ? "Undo" : "Shared ✓"}
          </button>
        </form>
      </div>
    </div>
  );
}
