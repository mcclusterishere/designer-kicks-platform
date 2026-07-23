"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registerUser } from "@/app/account-actions";
import type { ActionResult } from "@/app/actions";
import { checkEmailDomain } from "@/lib/emailDomains";

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function RegisterForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    registerUser,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);
  // Email-domain guard: typos hard-block with the fix offered; unknown
  // (self-hosted) domains go through the confirm-it interstitial.
  const [typo, setTypo] = useState<string | null>(null);
  const [unknownDomain, setUnknownDomain] = useState<string | null>(null);
  const [armed, setArmed] = useState(false); // click 1 of 2 inside the card
  const approved = useRef(false); // set after click 2 — lets submit pass

  function guardSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (approved.current) return; // confirmed custom domain — go
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    const check = checkEmailDomain(email);
    if (check.verdict === "ok") return;
    e.preventDefault();
    if (check.verdict === "typo") {
      setTypo(check.suggestion);
    } else {
      setArmed(false);
      setUnknownDomain(check.domain);
    }
  }

  function applySuggestion() {
    const input = formRef.current?.elements.namedItem("email") as HTMLInputElement | null;
    if (input && typo) {
      input.value = input.value.replace(/@[^@]*$/, `@${typo}`);
    }
    setTypo(null);
  }

  // A note means something merged (a pre-loaded page attached, or a
  // claim is pending) — let them read it before moving on. Silent
  // success goes straight through.
  useEffect(() => {
    if (state?.ok && !state.note) {
      router.push("/profile");
      router.refresh();
    }
  }, [state?.ok, state?.note, router]);

  if (state?.ok && state.note) {
    return (
      <div className="space-y-4" data-testid="register-note">
        <p className="rounded-lg border border-volt/40 bg-volt/5 p-4 text-sm text-white">
          ✓ Account created. {state.note}
        </p>
        <button
          type="button"
          onClick={() => {
            router.push("/profile");
            router.refresh();
          }}
          className="w-full rounded-lg btn-hard py-3 tag font-bold"
        >
          Take Me To My Profile →
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={guardSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="tag text-smoke">Name</label>
        <input id="name" name="name" required maxLength={60} autoComplete="name" className={inputClass} />
      </div>
      <div>
        <label htmlFor="email" className="tag text-smoke">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
          onChange={() => {
            setTypo(null);
            approved.current = false;
          }}
        />
        {typo && (
          <div role="alert" className="mt-2 rounded-lg border-2 border-heat bg-heat/10 p-3">
            <p className="text-sm font-bold text-white">
              That email service doesn&apos;t exist — looks like a typo.
            </p>
            <button
              type="button"
              onClick={applySuggestion}
              className="mt-2 w-full rounded-lg bg-heat py-2.5 tag font-bold text-ink"
            >
              Fix it → @{typo}
            </button>
          </div>
        )}
      </div>
      <div>
        <label htmlFor="password" className="tag text-smoke">Password (8+ characters)</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </div>
      <label htmlFor="age13" className="flex items-start gap-2 text-sm text-smoke">
        <input id="age13" name="age13" type="checkbox" required className="mt-0.5 h-4 w-4 accent-[#f04e45]" />
        <span>
          I&apos;m at least 13 years old. The Heat Chart isn&apos;t for
          children under 13.
        </span>
      </label>
      <label htmlFor="pma" className="flex items-start gap-2 text-sm text-smoke">
        <input id="pma" name="pma" type="checkbox" required className="mt-0.5 h-4 w-4 accent-[#f04e45]" />
        <span>
          I&apos;ve read and agree to the{" "}
          <a href="/equity-uprise" target="_blank" className="text-volt underline">
            Equity Uprise Private Member Association Membership Agreement
          </a>{" "}
          and I&apos;m joining as a private member.
        </span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-heat">{state.error}</p>}

      {unknownDomain && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 p-5"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="domain-check-title"
        >
          <div className="w-full max-w-md rounded-2xl border-2 border-heat bg-surface p-6 shadow-[0_0_60px_rgba(217,185,106,0.25)]">
            <p className="tag text-heat">Hold up — check this</p>
            <h2 id="domain-check-title" className="display mt-2 text-2xl text-white">
              Is <span className="text-volt">@{unknownDomain}</span> really your email?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-smoke">
              That&apos;s not a mail service we recognize. If it&apos;s your own
              domain — a work or personal address — you&apos;re good, confirm
              below. But if you meant Gmail, Yahoo, Outlook or another
              everyday address, <strong className="text-white">fix it now</strong>:
              one wrong letter here and you can never reset your password,
              and battle alerts, approvals, and giveaway wins will never
              reach you.
            </p>
            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={() => setUnknownDomain(null)}
                className="w-full rounded-lg btn-hard py-3 tag font-bold"
              >
                Let me fix my email
              </button>
              {!armed ? (
                <button
                  type="button"
                  onClick={() => setArmed(true)}
                  className="w-full rounded-lg border border-edge py-3 tag font-bold text-smoke transition hover:border-heat hover:text-white"
                >
                  It&apos;s right — this is my own domain
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    approved.current = true;
                    setUnknownDomain(null);
                    formRef.current?.requestSubmit();
                  }}
                  className="w-full rounded-lg border-2 border-heat bg-heat/15 py-3 tag font-bold text-heat"
                >
                  Confirm: sign me up with @{unknownDomain}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg btn-hard py-3 tag font-bold disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create Account"}
      </button>
    </form>
  );
}
