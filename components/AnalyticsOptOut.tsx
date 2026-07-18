"use client";

import { useEffect, useState } from "react";
import { OPT_OUT_KEY } from "./TrackPageview";

// One-tap analytics opt-out, honored by the pageview beacon. Stored
// in this browser only — no account needed, nothing sent anywhere.
export default function AnalyticsOptOut() {
  const [optedOut, setOptedOut] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setOptedOut(localStorage.getItem(OPT_OUT_KEY) === "1");
    } catch {
      setOptedOut(false);
    }
  }, []);

  function toggle() {
    const next = !optedOut;
    try {
      if (next) localStorage.setItem(OPT_OUT_KEY, "1");
      else localStorage.removeItem(OPT_OUT_KEY);
    } catch {}
    setOptedOut(next);
  }

  if (optedOut === null) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-surface p-4">
      <p className="text-sm">
        Analytics on this browser:{" "}
        <span className={optedOut ? "text-heat" : "text-volt"}>
          {optedOut ? "opted out" : "on (anonymous)"}
        </span>
      </p>
      <button
        onClick={toggle}
        className="tag rounded-lg border border-volt/40 px-4 py-2 text-white transition hover:border-volt hover:bg-volt/10"
      >
        {optedOut ? "Turn analytics back on" : "Opt out of analytics"}
      </button>
    </div>
  );
}
