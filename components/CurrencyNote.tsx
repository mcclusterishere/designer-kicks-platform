"use client";

import { useMoney } from "./MoneyProvider";

/**
 * States the unit once, for tables too narrow to carry a dollar reference
 * next to every figure.
 *
 * A client leaf on purpose. The exchange table around it is a server
 * component rendering hundreds of rows, and it should stay that way — this
 * is the only part of it that needs to read the viewer's currency, so it's
 * the only part that crosses to the client.
 */
export default function CurrencyNote() {
  const money = useMoney();
  if (money.currency === "USD") return null;
  return (
    <span className="ml-2">
      · figures converted to {money.currency} from USD
      {money.live ? "" : " (approximate table)"}
    </span>
  );
}

/**
 * The dollar price under the local one, in the exchange's headline column.
 * Renders nothing when the viewer is already reading dollars, so the row
 * doesn't print the same number twice.
 */
export function UsdSubLine({ cents }: { cents: number }) {
  const money = useMoney();
  if (money.currency === "USD") return null;
  return (
    <span className="block text-[10px] font-normal text-smoke">
      ${Math.round(cents / 100).toLocaleString("en-US")}
    </span>
  );
}
