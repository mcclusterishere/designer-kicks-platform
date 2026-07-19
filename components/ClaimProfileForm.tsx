"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitArtistClaim } from "@/app/actions";

/**
 * The claim terminal. Shown only on unclaimed (pre-loaded) artist
 * pages — the real artist walks a conversational, one-question-at-a-
 * time onboarding styled like a command line. Seller non-negotiables
 * (email, phone, street mailing address — no P.O. Boxes) are collected
 * with an explicit privacy promise: admin eyes only, never public.
 *
 * Navigation is forgiving on purpose: every answer can be revisited
 * (back button or tap the transcript), revisits prefill the saved
 * answer, and confirming an edit jumps straight back to the first
 * unanswered question — usually the review screen, not a re-walk.
 * Paste a full "street, city, ST zip" address at the street step and
 * it splits itself into the right boxes.
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
      "Phone number — digits only is fine, e.g. 719 555 0134. Non-negotiable for sellers, and it stays PRIVATE: admin eyes only, never shown on the site.",
    placeholder: "(719) 555-0134",
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
      "Street line ONLY — house number + street name, plus apt/unit if you have one. Example: 412 W 9th St, Apt 3. City, state, and ZIP are the NEXT three questions, one at a time. (Or paste the whole address and I'll split it.) No P.O. Boxes — and it's never public: admin eyes only, for seller verification and league mail.",
    placeholder: "412 W 9th St, Apt 3",
    validate: (v) => {
      if (!v || v.length > 120) return "The street line is required.";
      if (/\b(p\.?\s*o\.?\s*box|post\s*office\s*box|pob\b)/i.test(v))
        return "No P.O. Boxes — we need a street address. It stays private, promise.";
      return null;
    },
  },
  {
    key: "city",
    prompt: "City — just the city, e.g. Pueblo.",
    placeholder: "city",
    validate: (v) => (v.length > 0 && v.length <= 60 ? null : "City is required."),
  },
  {
    key: "state",
    prompt: "State — two letters, e.g. CO.",
    placeholder: "CO",
    validate: (v) => (v.length > 0 && v.length <= 30 ? null : "State is required."),
  },
  {
    key: "zip",
    prompt: "ZIP code — five digits, e.g. 81005.",
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

const stepIndex = (key: string) => STEPS.findIndex((s) => s.key === key);

/**
 * Try to read a pasted full US address: "412 W 9th St, Apt 3, Pueblo,
 * CO 81005" (state+zip together or comma-separated). Returns the four
 * pieces or null if it doesn't confidently parse.
 */
function splitFullAddress(
  v: string
): { addressLine: string; city: string; state: string; zip: string } | null {
  const m = v.match(
    /^(.+?),\s*([A-Za-z .'-]+?),?\s+([A-Za-z]{2})\.?,?\s+(\d{5}(?:-\d{4})?)$/
  );
  if (!m) return null;
  // The street part may itself contain a comma (apt/unit) — the first
  // capture is greedy-left, so "412 W 9th St, Apt 3" survives whole.
  const [, addressLine, city, state, zip] = m;
  if (!addressLine.trim() || !city.trim()) return null;
  return {
    addressLine: addressLine.trim(),
    city: city.trim(),
    state: state.toUpperCase(),
    zip,
  };
}

/** Does this look like a whole address crammed into the street box? */
function looksLikeFullAddress(v: string): boolean {
  return /\d{5}(-\d{4})?\s*$/.test(v) || (v.match(/,/g) ?? []).length >= 2;
}

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
  const [info, setInfo] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [doneNote, setDoneNote] = useState<string | null>(null);
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

  /** First never-answered step after i, or the review screen. */
  function nextUnanswered(after: number, a: Record<string, string>): number {
    for (let j = after + 1; j < STEPS.length; j++) {
      if (a[STEPS[j].key] === undefined) return j;
    }
    return STEPS.length;
  }

  /** Move to a step with its saved answer already in the box —
   *  revisits never blank out, and there's no empty-flash frame. */
  function goTo(target: number, a: Record<string, string>) {
    setValue(target < STEPS.length ? a[STEPS[target].key] ?? "" : "");
    setError(null);
    setStep(target);
  }

  function advance() {
    const v = value.trim();
    if (!current.optional && !v) {
      setError("This one's required.");
      return;
    }

    // The street step is where whole addresses get pasted — split a
    // parseable one into all four boxes instead of scolding.
    if (current.key === "addressLine") {
      const full = splitFullAddress(v);
      if (full) {
        if (/\b(p\.?\s*o\.?\s*box|post\s*office\s*box|pob\b)/i.test(full.addressLine)) {
          setError("No P.O. Boxes — we need a street address. It stays private, promise.");
          return;
        }
        const merged = { ...answers, ...full };
        setAnswers(merged);
        setInfo(
          "That was the whole address — I split it into street / city / state / ZIP for you. Check the transcript, tap anything that's off."
        );
        goTo(nextUnanswered(stepIndex("zip"), merged), merged);
        return;
      }
      if (looksLikeFullAddress(v)) {
        setError(
          "That looks like the full address — this box is just the street line (number + street). City, state, and ZIP come next. Or paste it as 'street, city, ST 81005' and I'll split it."
        );
        return;
      }
    }

    const bad = current.validate?.(v) ?? null;
    if (bad && (v || !current.optional)) {
      setError(bad);
      return;
    }
    const normalized =
      current.key === "state" && v.length === 2 ? v.toUpperCase() : v;
    const merged = { ...answers, [current.key]: normalized };
    setAnswers(merged);
    setInfo(null);
    // Editing an old answer jumps back to the first gap — usually the
    // review screen — instead of re-walking every later question.
    goTo(nextUnanswered(step, merged), merged);
  }

  function goBack() {
    if (step === 0) return;
    setInfo(null);
    goTo(Math.min(step, STEPS.length) - 1, answers);
  }

  function editStep(i: number) {
    setInfo(null);
    goTo(i, answers);
  }

  function submit() {
    setServerError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("artistId", artistId);
      for (const s of STEPS) fd.set(s.key, answers[s.key] ?? "");
      const res = await submitArtistClaim(null, fd);
      if (res.ok) {
        setDoneNote(res.note ?? null);
        setDone(true);
      } else setServerError(res.error ?? "Something went wrong — try again.");
    });
  }

  if (done) {
    return (
      <div className="mt-8 rounded-xl border border-volt/50 bg-volt/5 p-5 text-center">
        <p className="display text-xl text-volt">Claim received ✓</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-smoke">
          {doneNote ??
            "The league office reviews every claim by hand. Once verified, your password-setting link goes to the email you gave — then this page is yours."}
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

        {info && <p className="text-volt">✓ {info}</p>}

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
                className="min-w-0 flex-1 rounded border border-transparent bg-transparent text-white caret-[#d9b96a] placeholder:text-smoke/60 focus:border-volt/60 focus:outline-none"
              />
              {step > 0 && (
                <button
                  type="button"
                  data-testid="claim-back"
                  onClick={goBack}
                  title="Back to the previous question"
                  className="tag shrink-0 rounded border border-edge px-3 py-1.5 text-smoke transition hover:border-volt hover:text-white"
                >
                  ← back
                </button>
              )}
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
              {step + 1} / {STEPS.length} · ← back or tap any earlier answer to
              fix it — your answers stay put
            </p>
          </div>
        )}

        {/* Review + submit */}
        {review && (
          <div>
            <p className="text-white">
              <span className="text-volt">✓</span> That&apos;s everything.
              Double-check the transcript above (tap an answer to edit —
              you&apos;ll come straight back here), then file it.
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
