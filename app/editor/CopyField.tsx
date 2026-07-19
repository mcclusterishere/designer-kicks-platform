"use client";

import { useState } from "react";

/**
 * A read-only value with a one-tap Copy button — used for the editor's
 * tracked link. Falls back to select-on-focus if the clipboard API is
 * blocked (older mobile browsers, insecure origins).
 */
export default function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <div>
      {label && <p className="font-mono text-[10px] uppercase tracking-wider text-smoke">{label}</p>}
      <div className="mt-1 flex items-stretch gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-xs text-volt"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg border border-volt/60 bg-volt/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-volt transition hover:bg-volt/20"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}
