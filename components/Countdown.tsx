"use client";

import { useSyncExternalStore } from "react";

function format(msLeft: number): string {
  if (msLeft <= 0) return "ENDED";
  const s = Math.floor(msLeft / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function subscribe(onTick: () => void) {
  const t = setInterval(onTick, 1000);
  return () => clearInterval(t);
}

// Rounded to the second so the snapshot is stable between ticks.
const getNow = () => Math.floor(Date.now() / 1000) * 1000;

export default function Countdown({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  // Server snapshot is null so SSR + first client render match, then the
  // real clock takes over — avoids a hydration mismatch on the countdown.
  const now = useSyncExternalStore(subscribe, getNow, () => null);

  if (now === null) return <span className="tag text-heat">…</span>;

  const left = end - now;
  return (
    <span className={`tag ${left <= 0 ? "text-smoke" : "text-heat"}`}>
      {format(left)}
    </span>
  );
}
