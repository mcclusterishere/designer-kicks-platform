"use client";

import { useRouter } from "next/navigation";
import { PICKER } from "@/lib/currency";
import { useMoney } from "./MoneyProvider";

/**
 * Pick your own money.
 *
 * Detection gets it right most of the time and will always be wrong some of
 * the time — someone travelling, someone on a VPN, someone whose phone is
 * set to another country. A picker is the only mechanism that's right every
 * time, so it lives in the footer of every page rather than buried in
 * account settings, and the choice sticks for a year.
 */
export default function CurrencyPicker() {
  const money = useMoney();
  const router = useRouter();

  function choose(code: string) {
    document.cookie = `thc-currency=${code}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  // Detected currencies outside the shortlist still need to show as selected,
  // otherwise the control would silently disagree with the prices on screen.
  const options = PICKER.some((p) => p.code === money.currency)
    ? PICKER
    : [{ code: money.currency, label: money.currency }, ...PICKER];

  return (
    <label className="inline-flex items-center gap-2">
      <span className="tag text-smoke">Prices in</span>
      <select
        value={money.currency}
        onChange={(e) => choose(e.target.value)}
        aria-label="Show prices in this currency"
        className="rounded-lg border border-edge bg-surface px-2.5 py-1.5 text-sm text-white focus:border-volt focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.code} — {o.label}
          </option>
        ))}
      </select>
      {money.currency !== "USD" && (
        <span className="tag text-smoke">
          converted from USD{money.live ? "" : " · approximate table"}
        </span>
      )}
    </label>
  );
}
