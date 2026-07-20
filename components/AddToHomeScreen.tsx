"use client";

import { useEffect, useState } from "react";

/**
 * The "get the app" nudge, iOS-only. Safari has no install prompt API,
 * so we show a one-time banner teaching Share → Add to Home Screen.
 * Hidden when already installed (standalone), on other platforms, and
 * for 30 days after dismissal. Pure client-side — zero server impact.
 */
export default function AddToHomeScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    const dismissedAt = Number(localStorage.getItem("a2hs-dismissed") || 0);
    const recentlyDismissed = Date.now() - dismissedAt < 30 * 24 * 60 * 60 * 1000;
    if (isIos && !standalone && !recentlyDismissed) setShow(true);
  }, []);

  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-20 z-[60] rounded-2xl border border-volt/40 bg-panel/95 p-4 shadow-2xl backdrop-blur md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="tag text-volt">Get the app — free, 10 seconds</p>
          <p className="mt-1 text-sm text-white">
            Tap <span className="font-bold">Share</span>{" "}
            <span aria-hidden>⎋</span> below, then{" "}
            <span className="font-bold">&ldquo;Add to Home Screen&rdquo;</span> —
            The Heat Chart runs full-screen like a real app.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem("a2hs-dismissed", String(Date.now()));
            setShow(false);
          }}
          className="shrink-0 rounded-full border border-edge px-2.5 py-1 text-sm text-smoke"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
