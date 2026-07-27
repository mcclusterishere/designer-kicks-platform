/**
 * Native haptic bridge: inside the iOS shell, key moments (casting a
 * vote, clearing the deck) tap the Taptic Engine through the shell's
 * "haptic" message handler. On the open web this is a silent no-op.
 */
export function appHaptic(kind: "success" | "light" | "warning") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).webkit?.messageHandlers?.haptic?.postMessage(kind);
  } catch {
    // not in the shell — nothing to do
  }
}
