"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * A password box you can actually see into, and — when you're setting one
 * — type twice.
 *
 * Both halves exist because of the same failure, reported from a real
 * signup on a phone: you cannot tell what you typed, so you find out the
 * password was wrong at the moment you next try to sign in, which is days
 * later, on a different device, with no idea what you meant to type. On
 * this platform that is worse than it sounds — an artist locked out of an
 * account holding their pieces, their sales and their customer list has to
 * go through email recovery, and the whole roster was onboarded by hand.
 *
 * The two guards catch different mistakes and that's why both are here
 * rather than one:
 *
 *   - REVEAL catches the typo you'd spot instantly if you could see it.
 *     Masking a password defends against someone reading your screen;
 *     on a phone, held at arm's length, alone, that threat is mostly
 *     imaginary and the cost is real. So it's off by default and one tap
 *     away — never revealed automatically, because sometimes the person
 *     over your shoulder IS real and that has to stay their call.
 *   - CONFIRM catches the typo you make the same way twice-over — the
 *     wrong finger position, the caps-lock, the phone keyboard that
 *     swallowed a character. You can be looking straight at a password
 *     and still not notice it isn't what you meant.
 *
 * The mismatch is wired through setCustomValidity, so the BROWSER refuses
 * to submit and says why in its own voice. That matters more than a
 * prettier custom message: it works before any of our JavaScript decides
 * to, it can't be out-run by a fast double-tap on the submit button, and
 * it reads in the user's own language.
 *
 * The server still checks. This is a courtesy to the person typing, not a
 * security boundary — anything a client can enforce, a client can skip.
 */
export default function PasswordField({
  name = "password",
  label = "Password",
  autoComplete = "current-password",
  minLength,
  confirm = false,
  confirmName = "confirmPassword",
  confirmLabel = "Type it again",
  autoFocus = false,
}: {
  name?: string;
  label?: string;
  autoComplete?: string;
  minLength?: number;
  autoFocus?: boolean;
  /** Renders a second box. Use wherever a password is SET, not entered. */
  confirm?: boolean;
  confirmName?: string;
  confirmLabel?: string;
}) {
  const uid = useId();
  const id = `${name}${uid}`;
  const confirmId = `${confirmName}${uid}`;
  const [visible, setVisible] = useState(false);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const confirmRef = useRef<HTMLInputElement>(null);

  const mismatch = confirm && second.length > 0 && first !== second;
  const matched = confirm && second.length > 0 && first === second;

  useEffect(() => {
    if (!confirm) return;
    confirmRef.current?.setCustomValidity(
      second.length > 0 && first !== second ? "Both passwords need to match." : ""
    );
  }, [confirm, first, second]);

  const box =
    "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2.5 pr-20 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

  return (
    <>
      <div>
        <label htmlFor={id} className="tag text-smoke">
          {label}
        </label>
        <div className="relative">
          <input
            id={id}
            name={name}
            type={visible ? "text" : "password"}
            required
            minLength={minLength}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            className={box}
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            // Both halves of the state are spoken: the label says what the
            // button DOES, aria-pressed says what the field currently IS.
            // A screen-reader user who tabs onto it mid-form needs the
            // second one to know whether their password is on screen.
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 tag text-smoke transition hover:text-volt focus:text-volt focus:outline-none"
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {confirm && (
        <div>
          <label htmlFor={confirmId} className="tag text-smoke">
            {confirmLabel}
          </label>
          <div className="relative">
            <input
              ref={confirmRef}
              id={confirmId}
              name={confirmName}
              type={visible ? "text" : "password"}
              required
              minLength={minLength}
              autoComplete={autoComplete}
              className={box}
              value={second}
              onChange={(e) => setSecond(e.target.value)}
              aria-describedby={mismatch ? `${confirmId}-err` : undefined}
              aria-invalid={mismatch || undefined}
            />
          </div>
          {/* Says nothing until there is something to say. A "passwords
              don't match" warning that appears on the first keystroke of
              an empty box is noise, and people learn to ignore it. */}
          {mismatch && (
            <p id={`${confirmId}-err`} role="alert" className="mt-1.5 text-sm text-heat">
              These don&apos;t match yet.
            </p>
          )}
          {matched && <p className="mt-1.5 text-sm text-volt">✓ Match.</p>}
        </div>
      )}
    </>
  );
}
