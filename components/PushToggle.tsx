"use client";

import { useEffect, useState } from "react";
import { savePushSub, removePushSub } from "@/app/actions";

/**
 * Turn alerts on for this device.
 *
 * Deliberately opt-in and deliberately specific about what it will send. The
 * fastest way to get a notification permission revoked is to ask for it with
 * no stated purpose and then use it for marketing, so this says exactly what
 * it's for and sends only that.
 */
export default function PushToggle({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<"unknown" | "off" | "on" | "blocked" | "unsupported">("unknown");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!vapidKey || typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [vapidKey]);

  async function enable() {
    if (!vapidKey) return;
    setBusy(true);
    setNote(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("incomplete");
      const res = await savePushSub(json.endpoint, json.keys.p256dh, json.keys.auth, navigator.userAgent);
      setNote(res.ok ? res.note ?? "On." : res.error ?? "Couldn't turn those on.");
      if (res.ok) setState("on");
    } catch {
      setNote("This browser wouldn't complete the handshake. Safari needs the site added to your home screen first.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSub(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setNote("Alerts off.");
    } catch {
      setNote("Couldn't turn those off — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported") return null;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <p className="tag text-heat">Alerts</p>
      <p className="mt-0.5 text-sm text-white">
        {state === "on" ? "This device gets alerts." : "Get told when it matters."}
      </p>
      <p className="mt-1 text-xs text-smoke">
        Four things only: a drop landing tomorrow, a battle closing within the hour,
        an artist answering your commission, and one of your calls settling. Nothing else.
      </p>

      {state === "blocked" ? (
        <p className="mt-3 text-sm text-heat">
          Notifications are blocked for this site in your browser settings — you&apos;ll need to
          allow them there first.
        </p>
      ) : (
        <button
          onClick={state === "on" ? disable : enable}
          disabled={busy || state === "unknown"}
          className={`mt-3 rounded-lg px-4 py-2 tag font-bold disabled:opacity-50 ${
            state === "on" ? "border border-edge text-smoke" : "btn-hard"
          }`}
        >
          {busy ? "…" : state === "on" ? "Turn alerts off" : "Turn alerts on"}
        </button>
      )}
      {note && <p className="mt-2 text-xs text-volt">{note}</p>}
    </div>
  );
}

/**
 * VAPID keys travel base64url; PushManager wants raw bytes.
 *
 * Backed by an explicit ArrayBuffer so the type is the plain
 * Uint8Array<ArrayBuffer> the DOM signature asks for, rather than the
 * ArrayBufferLike a bare `new Uint8Array(n)` widens to.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
