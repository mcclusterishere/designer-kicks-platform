"use client";

import { useActionState, useState } from "react";
import {
  chatbotInstallAction,
  chatbotSettingAction,
  chatFlowOpAction,
  chatFlowSaveAction,
} from "@/app/actions";
import type { ActionResult } from "@/app/actions";

/**
 * Client half of the Chat bot panel. The flow builder is deliberately a
 * FORM, not a canvas: a flow is a message plus buttons pointing at
 * other flows, and a form states that more plainly than a diagram —
 * while storing the exact same graph the canvas products sell.
 */

const input =
  "w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";
const btn = "rounded-lg btn-hard px-3 py-2 tag font-bold disabled:opacity-50";
const ghost =
  "rounded-lg border border-edge px-3 py-1.5 tag text-smoke transition hover:text-white disabled:opacity-50";

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return state.ok ? (
    state.note ? <p className="mt-1.5 text-sm text-volt">{state.note}</p> : null
  ) : (
    <p className="mt-1.5 text-sm text-heat" role="alert">{state.error}</p>
  );
}

export function BotToggles({
  enabled,
  aiOn,
  publicOn,
}: {
  enabled: boolean;
  aiOn: boolean;
  publicOn: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    chatbotSettingAction,
    null
  );
  return (
    <form action={action} className="flex flex-wrap gap-2">
      <button name="op" value="toggle" disabled={pending} className={enabled ? btn : ghost}>
        {enabled ? "Bot is ON" : "Bot is OFF — turn on"}
      </button>
      <button name="op" value="toggle-ai" disabled={pending} className={aiOn ? btn : ghost}>
        {aiOn ? "DM AI fallback ON" : "DM AI fallback OFF"}
      </button>
      <button name="op" value="toggle-public" disabled={pending} className={publicOn ? btn : ghost}>
        {publicOn ? "Public comment replies ON" : "Public comment replies OFF"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function CommentStyleForm({ style }: { style: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    chatbotSettingAction,
    null
  );
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="op" value="commentStyle" />
      <textarea name="commentStyle" defaultValue={style} rows={4} className={input} />
      <div className="mt-2 flex items-center gap-3">
        <button disabled={pending} className={btn}>{pending ? "…" : "Save comment style"}</button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function GifLibraryForm({ gifs }: { gifs: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    chatbotSettingAction,
    null
  );
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="op" value="gifs" />
      <textarea
        name="gifs"
        defaultValue={gifs}
        rows={5}
        placeholder={"fire https://…/fire.gif\nsheesh https://…/sheesh.gif\nrespect https://…/salute.gif"}
        className={input}
      />
      <p className="mt-1 text-xs opacity-60">
        One per line: tag, space, direct GIF link. Tags the bot knows: fire, respect, thinking,
        sheesh, cold, classic, nah, crying, chef-kiss. Empty tags stay text-only. Facebook comments
        only — Instagram can&apos;t take comment GIFs.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button disabled={pending} className={btn}>{pending ? "…" : "Save GIF library"}</button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function PersonaForm({ persona }: { persona: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    chatbotSettingAction,
    null
  );
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="op" value="persona" />
      <textarea name="persona" defaultValue={persona} rows={4} className={input} />
      <div className="mt-2 flex items-center gap-3">
        <button disabled={pending} className={btn}>{pending ? "…" : "Save voice"}</button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

type FlowOption = { id: string; name: string };

export function FlowForm({ flows }: { flows: FlowOption[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    chatFlowSaveAction,
    null
  );
  const [trigger, setTrigger] = useState("comment");
  const [buttons, setButtons] = useState<number[]>([0]);

  return (
    <form action={action} className="mt-3 space-y-2 rounded-lg border border-edge bg-panel p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="name" placeholder='Flow name (e.g. "Vest giveaway")' className={input} required />
        <select name="trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)} className={input}>
          <option value="comment">Someone comments on a post</option>
          <option value="message">A DM contains a keyword</option>
          <option value="icebreaker">Tap-to-start question (front door)</option>
          <option value="welcome">First message from anyone new</option>
          <option value="default">Anything nothing else caught</option>
        </select>
      </div>

      {(trigger === "comment" || trigger === "message") && (
        <input
          name="keywords"
          placeholder="Keywords, comma-separated — or * for every single one"
          className={input}
        />
      )}
      {trigger === "comment" && (
        <>
          <input name="postId" placeholder="Limit to one post id (optional — blank = all posts)" className={input} />
          <textarea
            name="privateReply"
            rows={2}
            placeholder='The ONE private reply sent to their inbox. Make it earn an answer — their reply is what opens the conversation. e.g. "You commented 🔥 — want the drop link or the giveaway?"'
            className={input}
          />
        </>
      )}

      <textarea
        name="message"
        rows={3}
        required
        placeholder="The message this flow sends in the DM conversation."
        className={input}
      />

      <p className="tag text-smoke">Buttons — each one jumps to another flow</p>
      {buttons.map((n) => (
        <div key={n} className="grid gap-2 sm:grid-cols-2">
          <input name="qrLabel" placeholder="Button label (20 chars shows)" className={input} />
          <select name="qrFlow" className={input} defaultValue="">
            <option value="">— goes nowhere (remove) —</option>
            {flows.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {buttons.length < 13 && (
          <button
            type="button"
            onClick={() => setButtons((b) => [...b, (b[b.length - 1] ?? 0) + 1])}
            className={ghost}
          >
            + button
          </button>
        )}
        <button disabled={pending} className={btn}>{pending ? "…" : "Create flow"}</button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function FlowButtons({ flowId, active }: { flowId: string; active: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    chatFlowOpAction,
    null
  );
  return (
    <form action={action} className="flex shrink-0 gap-2">
      <input type="hidden" name="flowId" value={flowId} />
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

export function InstallForm({ hasOpeners }: { hasOpeners: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    chatbotInstallAction,
    null
  );
  return (
    <form action={action} className="mt-2">
      <input
        name="greeting"
        placeholder='Greeting above the Get Started button (e.g. "Custom heat, voted on by the culture. Tap in.")'
        className={input}
        required
      />
      <div className="mt-2 flex items-center gap-3">
        <button disabled={pending} className={btn}>
          {pending ? "…" : "Install front door on the Page"}
        </button>
        <Feedback state={state} />
      </div>
      {!hasOpeners && (
        <p className="mt-1 text-xs text-smoke">
          Tip: create flows with the &quot;tap-to-start question&quot; trigger first — up to four
          become the questions new visitors can tap before typing.
        </p>
      )}
    </form>
  );
}
