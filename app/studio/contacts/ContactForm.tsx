"use client";

import { useActionState } from "react";
import { saveContactAction, type ActionResult } from "@/app/actions";

type Defaults = {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  social?: string | null;
  city?: string | null;
  notes?: string | null;
  emailOptIn?: boolean;
};

const input =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function ContactForm({ defaults }: { defaults?: Defaults }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveContactAction,
    null
  );
  const editing = Boolean(defaults?.id);
  const k = defaults?.id ?? "new";

  return (
    <form action={formAction} className="space-y-3" key={k}>
      {editing && <input type="hidden" name="id" value={defaults!.id} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor={`c-name-${k}`}>
            Name *
          </label>
          <input id={`c-name-${k}`} name="name" required defaultValue={defaults?.name} className={input} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor={`c-email-${k}`}>
            Email
          </label>
          <input
            id={`c-email-${k}`}
            name="email"
            type="email"
            defaultValue={defaults?.email ?? ""}
            className={input}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="tag text-smoke" htmlFor={`c-phone-${k}`}>
            Phone
          </label>
          <input id={`c-phone-${k}`} name="phone" defaultValue={defaults?.phone ?? ""} className={input} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor={`c-social-${k}`}>
            Instagram
          </label>
          <input
            id={`c-social-${k}`}
            name="social"
            defaultValue={defaults?.social ?? ""}
            placeholder="@handle"
            className={input}
          />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor={`c-city-${k}`}>
            City
          </label>
          <input id={`c-city-${k}`} name="city" defaultValue={defaults?.city ?? ""} className={input} />
        </div>
      </div>

      <div>
        <label className="tag text-smoke" htmlFor={`c-notes-${k}`}>
          Notes
        </label>
        <input
          id={`c-notes-${k}`}
          name="notes"
          defaultValue={defaults?.notes ?? ""}
          placeholder="Size, what they bought, what they're after next"
          className={input}
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-smoke">
        <input
          type="checkbox"
          name="emailOptIn"
          defaultChecked={defaults?.emailOptIn}
          className="mt-0.5 h-4 w-4 accent-[#f04e45]"
        />
        <span>
          They said yes to hearing about new work by email.{" "}
          <span className="text-smoke/70">
            Only tick this if they actually did — it&apos;s the difference between a newsletter and
            spam.
          </span>
        </span>
      </label>

      {state && !state.ok && (
        <p role="alert" className="rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded border border-volt/40 bg-volt/10 px-3 py-2 text-sm text-volt">Saved.</p>
      )}

      <button
        disabled={pending}
        className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
      >
        {pending ? "Saving…" : editing ? "Save changes" : "Add contact"}
      </button>
    </form>
  );
}
