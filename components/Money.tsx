"use client";

import { formatMoney } from "@/lib/currency";
import { useMoney } from "./MoneyProvider";

/**
 * A price, in the reader's money.
 *
 * Every amount on the site is stored in USD cents, because that's the
 * currency the market data arrives in. This renders that amount in whatever
 * the reader actually uses, and — unless asked not to — keeps the dollar
 * figure alongside in small type.
 *
 * Both numbers stay visible on purpose. The dollar price is the real one;
 * the local figure is a conversion at today's rate, which is what someone
 * needs to judge whether a pair is worth it, but isn't what any marketplace
 * will actually charge them. Showing one without the other would hide which
 * is which.
 *
 * A client component so it can read the resolved currency from context,
 * which means it drops into server-rendered pages as a leaf without
 * turning anything above it into client code.
 */
export default function Money({
  cents,
  className = "",
  usdClassName = "",
  showUsd = true,
}: {
  cents: number | null | undefined;
  className?: string;
  /** Styling for the trailing dollar reference. */
  usdClassName?: string;
  /** Drop the dollar reference where space is genuinely tight. */
  showUsd?: boolean;
}) {
  const money = useMoney();
  if (cents == null) return <span className={className}>—</span>;

  const local = formatMoney(cents, money);
  const isUsd = money.currency === "USD";

  if (isUsd) return <span className={className}>{local}</span>;

  const usd = `$${Math.round(cents / 100).toLocaleString("en-US")}`;
  return (
    <span className={className}>
      {local}
      {showUsd && (
        <span className={`ml-1 whitespace-nowrap font-normal opacity-60 ${usdClassName}`}>({usd})</span>
      )}
    </span>
  );
}
