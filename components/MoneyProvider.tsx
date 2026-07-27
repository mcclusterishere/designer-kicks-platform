"use client";

import { createContext, useContext, useEffect } from "react";
import type { Money } from "@/lib/currency";

/**
 * The viewer's money, resolved on the server and handed down.
 *
 * Server-resolved rather than detected in the browser, so the very first
 * paint is already in the right currency — no dollars flashing before a
 * conversion arrives, and no layout shift when it does.
 *
 * The one thing the browser knows that the server can't is the device's
 * time zone, which is the most reliable evidence of where somebody actually
 * is. So this writes it to a cookie once and refreshes so the server can
 * use it from then on.
 */

const MoneyCtx = createContext<Money>({ currency: "USD", rate: 1, explicit: false, live: true });

export function useMoney(): Money {
  return useContext(MoneyCtx);
}

export default function MoneyProvider({
  money,
  knownTz,
  children,
}: {
  money: Money;
  knownTz: string | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Only ever done once, and never when the viewer has chosen for
    // themselves — an explicit pick must not be second-guessed by geography.
    if (money.explicit) return;
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {}
    if (!tz || tz === knownTz) return;
    document.cookie = `thc-tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    // One reload to pick up the currency this implies. Because the cookie
    // is now set, the condition above is false next time round, so this
    // can't loop.
    window.location.reload();
  }, [money.explicit, knownTz]);

  return <MoneyCtx.Provider value={money}>{children}</MoneyCtx.Provider>;
}
