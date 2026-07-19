"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitArtistClaim } from "@/app/actions";

/**
 * The claim terminal. Shown only on unclaimed (pre-loaded) artist
 * pages — the real artist walks a conversational, one-question-at-a-
 * time onboarding styled like a command line. Seller non-negotiables
 * (email, phone, street mailing address — no P.O. Boxes) are collected
 * with an explicit privacy promise: admin eyes only, never public.
 */

type Step = {
  key: string;
  prompt: string;
  placeholder: string;
  optional?: boolean;
  type?: string;
  validate?: (v: string) => string | null;
};

const STEPS: Step[] = [
  {
    key: "name",
    prompt: "First things first — what's your name?",
    placeholder: "your name",
    validate: (v) => (v.length > 0 && v.length <= 60 ? null : "Your name is required."),
  },
  {
    key: "email",
    prompt: "Your email. This becomes your login, so make it one you actually check.",
    placeholder: "you@example.com",
    type: "email",
    validate: (v) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "That doesn't look like an email.",
  },
  {
    key: "phone",
    prompt:
      "Phone number. Non-negotiable for sellers — it stays PRIVATE, admin eyes only, never shown on the site.",
    placeholder: "(555) 555-0134",
    type: "tel",
    validate: (v) =>
      v.replace(/\D/g, "").length >= 10 ? null : "A real phone number is required to sell here.",
  },
  {
    key: "businessName",
    prompt: "Got a business or shop name? (optional — enter to skip)",
    placeholder: "e.g. Crown City Kicks LLC",
    optional: true,
    validate: (v) => (v.length <= 80 ? null : "Keep it under 80 characters."),
  },
  {
    key: "addressLine",
    prompt:
      "Street mailing address. Also non-negotiable — and NO P.O. Boxes. It is never public: only the admin sees it, for seller verification and league mail.",
    placeholder: "street address",
    validate: (v) => {
      if (!v || v.length > 120) return "A street mailing address is required.";
      if (/\b(p\.?\s*o\.?\s*box|post\s*office\s*box|pob\b)/i.test(v))
        return "No P.O. Boxes — we need a street address. It stays private, promise.";
      return null;
    },
  },
  {
    key: "city",
    prompt: "City?",
    placeholder: "city",
    validate: (v) => (v.length > 0 && v.length <= 60 ? null : "City is required."),
  },
  {
    key: "state",
    prompt: "State?",
    placeholder: "e.g. CO",
    validate: (v) => (v.length > 0 && v.length <= 30 ? null : "State is required."),
  },
  {
    key: "zip",
    prompt: "ZIP code?",
    placeholder: "81005",
    validate: (v) => (/^\d{5}(-\d{4})?$/.test(v) ? null : "A valid ZIP code is required."),
  },
  {
    key: "socialProof",
    prompt:
      "Proof it's you — your Instagram handle or shop link, something we can match to this work.",
    placeholder: "@yourhandle or https://yourshop.com",
    validate: (v) => (v.length > 0 && v.length <= 120 ? null : "We need a link or handle to verify you."),
  },
  {
    key: "message",
    prompt: "Anything else the league office should know? (optional — enter to skip)",
    placeholder: "…",
    optional: true,
    validate: (v) => (v.length <= 400 ? null : "Keep it under 400 characters."),
  },
];

export default function ClaimProfileForm({
  artistId,
  displayName,
}: {
  artistId: string;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const current = STEPS[step];
  const review = step >= STEPS.length;

  useEffect(() => {
    if (open && !review) inputRef.current?.focus();
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, step, review]);

  function advance() {
    const v = value.trim();
    if (!current.optional && !v) {
      setError("This one's required.");
      return;
    }
    const bad = current.validate?.(v) ?? null;
    if (bad && (v || !current.optional)) {
      setError(bad);
      return;
    }
    setAnswers((a) => ({ ...a, [current.key]: v }));
    setValue("");
    setError(null);
    setStep((s) => s + 1);
  }

  function editStep(i: number) {
    setValue(answers[STEPS[i].key] ?? "");
    setStep(i);
    setError(null);
  }

  function submit() {
    setServerError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("artistId", artistId);
      for (const s of STEPS) fd.set(s.key, answers[s.key] ?? "");
      const res = await submitArtistClaim(null, fd);
      if (res.ok) setDone(true);
      else setServerError(res.error ?? "Something went wrong — try again.");
    });
  }

  if (done) {
    return (
      <div className="mt-8 rounded-xl border border-volt/50 bg-volt/5 p-5 text-center">
        <p className="display text-xl text-volt">Claim received ✓</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-smoke">
          The league office reviews every claim by hand. Once verified,
          your password-setting link goes to the email you gave — then
          this page is yours.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-volt/40 bg-surface p-5">
        <div>
          <p className="display text-lg text-white">Are you {displayName}?</p>
          <p className="text-sm text-smoke">
            This page was set up for the artist and is unclaimed. Two
            minutes of questions and the keys are yours.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="btn-hard rounded-lg px-5 py-2.5 tag font-bold"
        >
          Claim This Page
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-edge bg-[#0b0b0c] font-mono text-sm shadow-2xl">
      {/* Terminal chrome */}
      <div className="flex items-center gap-2 border-b border-edge bg-panel px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-heat/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#d9b96a]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-volt/70" />
        <p className="ml-2 truncate text-xs text-smoke">
          theheatchart — claim@{displayName.toLowerCase().replace(/\s+/g, "-")}
        </p>
      </div>

      <div className="max-h-[26rem] space-y-3 overflow-y-auto p-4">
        <p className="text-smoke">
          <span className="text-volt">league@heatchart:~$</span> verify-artist
          --page &quot;{displayName}&quot;
        </p>
        <p className="leading-relaxed text-smoke">
          Becoming a verified seller takes a few real answers. Email,
          phone, and a street mailing address are{" "}
          <span className="text-white">non-negotiable</span> — and your
          address and phone are <span className="text-white">private</span>
          : only the admin ever sees them, they never appear on the site.
          No P.O. Boxes.
        </p>

        {/* Transcript of answered questions */}
        {STEPS.slice(0, Math.min(step, STEPS.length)).map((s, i) => (
          <div key={s.key}>
            <p className="text-smoke/80">
              <span className="text-volt">?</span> {s.prompt}
            </p>
            <button
              type="button"
              onClick={() => editStep(i)}
              title="Edit this answer"
              className="text-left text-white underline-offset-4 hover:underline"
            >
              ❯ {answers[s.key] || <span className="text-smoke/60">(skipped)</span>}
            </button>
          </div>
        ))}

        {/* The live question */}
        {!review && (
          <div>
            <p className="text-white">
              <span className="text-volt">?</span> {current.prompt}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-volt">❯</span>
              <input
                ref={inputRef}
                data-testid="claim-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && advance()}
                type={current.type ?? "text"}
                placeholder={current.placeholder}
                aria-label={current.prompt}
                className="min-w-0 flex-1 border-0 bg-transparent text-white caret-[#d9b96a] placeholder:text-smoke/40 focus:outline-none"
              />
              <button
                type="button"
                data-testid="claim-next"
                onClick={advance}
                className="tag shrink-0 rounded border border-edge px-3 py-1.5 text-smoke transition hover:border-volt hover:text-white"
              >
                enter ↵
              </button>
            </div>
            {error && <p className="mt-1 text-heat">! {error}</p>}
            <p className="mt-2 text-xs text-smoke/60">
              {step + 1} / {STEPS.length} · tap any earlier answer to edit
            </p>
          </div>
        )}

        {/* Review + submit */}
        {review && (
          <div>
            <p className="text-white">
              <span className="text-volt">✓</span> That&apos;s everything.
              Double-check the transcript above (tap an answer to edit),
              then file it.
            </p>
            {serverError && <p className="mt-2 text-heat">! {serverError}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="btn-hard mt-3 w-full rounded-lg py-3 font-sans tag font-bold disabled:opacity-50"
            >
              {pending ? "Filing…" : "Submit Claim For Verification"}
            </button>
            <p className="mt-2 text-xs text-smoke/60">
              Address + phone stay with the league office only. Never
              public, never sold, used for seller verification and
              league mail.
            </p>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
