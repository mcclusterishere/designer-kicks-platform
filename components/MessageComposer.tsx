"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { sendMessage, type ActionResult } from "@/app/actions";

/**
 * The composer. Clears itself and refreshes on a successful send, so the
 * message appears in the thread without a manual reload.
 */
export default function MessageComposer({ toUserId, toName }: { toUserId: string; toName: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(sendMessage, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="rounded-2xl border border-edge bg-surface/95 p-2 backdrop-blur">
      <input type="hidden" name="toUserId" value={toUserId} />
      <div className="flex items-end gap-2">
        <textarea
          name="body"
          rows={2}
          maxLength={2000}
          required
          placeholder={`Message ${toName}…`}
          className="min-w-0 flex-1 resize-none rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
      {state && !state.ok && <p className="mt-1.5 px-1 text-sm text-heat">{state.error}</p>}
    </form>
  );
}
