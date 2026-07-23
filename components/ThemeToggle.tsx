"use client";

import { useEffect, useState } from "react";

/**
 * The day/night switch, now three-way: AUTO (default) follows the
 * member's own clock — light 7am–7pm local, dark at night; their
 * device time already speaks their timezone. Tapping cycles
 * Auto → Light → Dark. Manual picks persist; Auto re-checks each
 * minute so the theme rolls over by itself at dusk and dawn. The
 * pre-hydration script in the layout applies the same rule before
 * first paint, so there's never a flash.
 */

type Mode = "auto" | "light" | "dark";

function timeTheme(): "light" | "dark" {
  const h = new Date().getHours();
  return h >= 7 && h < 19 ? "light" : "dark";
}

function applyMode(mode: Mode) {
  const theme = mode === "auto" ? timeTheme() : mode;
  if (theme === "light") {
    document.documentElement.dataset.theme = "light";
  } else {
    delete document.documentElement.dataset.theme;
  }
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("auto");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("thc-theme");
    } catch {}
    const initial: Mode = stored === "light" || stored === "dark" ? stored : "auto";
    setMode(initial);
    applyMode(initial);
  }, []);

  // Auto mode rolls over on its own when the clock crosses 7am/7pm.
  useEffect(() => {
    if (mode !== "auto") return;
    const tick = setInterval(() => applyMode("auto"), 60_000);
    return () => clearInterval(tick);
  }, [mode]);

  const cycle = () => {
    const next: Mode = mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
    try {
      localStorage.setItem("thc-theme", next);
    } catch {}
    setMode(next);
    applyMode(next);
  };

  const label =
    mode === "auto"
      ? "Theme: auto (follows your local time) — tap for light"
      : mode === "light"
        ? "Theme: light — tap for dark"
        : "Theme: dark — tap for auto";

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={
        mode === "auto" ? "Auto — day/night by your clock" : mode === "light" ? "Light" : "Dark"
      }
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-edge text-smoke transition hover:border-volt hover:text-white"
    >
      {mode === "auto" ? (
        // Half sun, half moon — the clock decides.
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3a9 9 0 1 0 0 18Z" fill="currentColor" stroke="none" opacity="0.35" />
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18" />
        </svg>
      ) : mode === "light" ? (
        // Sun
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
        </svg>
      ) : (
        // Moon
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  );
}
