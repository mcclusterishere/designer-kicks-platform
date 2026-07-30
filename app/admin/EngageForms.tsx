"use client";

import { useActionState } from "react";
import {
  engageModerateAction,
  engageReplyAction,
  igLookupAction,
  inboxReplyAction,
  socialRuleAction,
} from "@/app/actions";
import type { ActionResult } from "@/app/actions";

/**
 * The client half of the Engagement desk: small forms, each wrapping
 * one server action. Kept in one file because they share a visual
 * grammar and none is big enough to live alone.
 */

const input =
  "w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";
const btn = "rounded-lg btn-hard px-3 py-1.5 tag font-bold disabled:opacity-50";
const ghost =
  "rounded-lg border border-edge px-3 py-1.5 tag text-smoke transition hover:text-white disabled:opacity-50";

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  if (state.ok)
    return state.note ? <p className="mt-1.5 text-sm text-volt">{state.note}</p> : null;
  return (
    <p className="mt-1.5 text-sm text-heat" role="alert">
      {state.error}
    </p>
  );
}

/** Reply box under a stored comment/DM event. */
export function EventReplyForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    engageReplyAction,
    null
  );
  return (
    <form action={action} className="mt-2 flex gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <input name="reply" placeholder="Answer them…" className={input} required />
      <button disabled={pending} className={btn}>
        {pending ? "…" : "Reply"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

/** Hide / mark-handled buttons on an event. */
export function ModerateButtons({ eventId, kind }: { eventId: string; kind: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    engageModerateAction,
    null
  );
  return (
    <form action={action} className="flex shrink-0 gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      {kind === "comment" && (
        <button name="op" value="hide" disabled={pending} className={ghost}>
          Hide
        </button>
      )}
      <button name="op" value="done" disabled={pending} className={ghost}>
        Done
      </button>
      <Feedback state={state} />
    </form>
  );
}

/** Reply straight into a live inbox conversation. */
export function InboxReplyForm({ senderId }: { senderId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    inboxReplyAction,
    null
  );
  return (
    <div>
      <form action={action} className="mt-2 flex gap-2">
        <input type="hidden" name="senderId" value={senderId} />
        <input name="reply" placeholder="Reply…" className={input} required />
        <button disabled={pending} className={btn}>
          {pending ? "…" : "Send"}
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

/** Create a new automation rule. */
export function RuleForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    socialRuleAction,
    null
  );
  return (
    <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr_1fr_auto]">
      <select name="kind" className={input} defaultValue="comment_keyword">
        <option value="comment_keyword">Comment contains…</option>
        <option value="dm_welcome">First DM from someone</option>
      </select>
      <input name="trigger" placeholder="Keyword (comment rules only)" className={input} />
      <input name="reply" placeholder="What to say back" className={input} required />
      <button disabled={pending} className={btn}>
        {pending ? "…" : "Add rule"}
      </button>
      <div className="sm:col-span-4">
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** Pause / delete an existing rule. */
export function RuleButtons({ ruleId, active }: { ruleId: string; active: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    socialRuleAction,
    null
  );
  return (
    <form action={action} className="flex shrink-0 gap-2">
      <input type="hidden" name="ruleId" value={ruleId} />
      <button name="op" value="toggle" disabled={pending} className={ghost}>
        {active ? "Pause" : "Resume"}
      </button>
      <button name="op" value="delete" disabled={pending} className={ghost}>
        Delete
      </button>
      <Feedback state={state} />
    </form>
  );
}

/** Look up any public IG business/creator account by handle. */
export function IgLookupForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    igLookupAction,
    null
  );
  return (
    <div>
      <form action={action} className="mt-2 flex gap-2">
        <input name="handle" placeholder="@customizer" className={input} required />
        <button disabled={pending} className={btn}>
          {pending ? "…" : "Look up"}
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}
