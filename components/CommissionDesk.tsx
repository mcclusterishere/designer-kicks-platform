"use client";

import { useMoney } from "@/components/MoneyProvider";
import { formatMoney, type Money as Wallet } from "@/lib/currency";

export type DeskInfo = {
  commissionOpen: boolean;
  commissionMinCents: number | null;
  commissionMaxCents: number | null;
  commissionDays: number | null;
  commissionSlots: number | null;
};

/**
 * "From ₵2,800" / "₵2,800–₵7,000" / "Ask" — never a number we don't have.
 *
 * A price range has to read as one phrase, so this returns a string rather
 * than elements, which means it needs the reader's currency passed in.
 */
export function priceLabel(d: DeskInfo, wallet: Wallet): string {
  const f = (c: number) => formatMoney(c, wallet);
  if (d.commissionMinCents && d.commissionMaxCents) {
    return `${f(d.commissionMinCents)}–${f(d.commissionMaxCents)}`;
  }
  if (d.commissionMinCents) return `From ${f(d.commissionMinCents)}`;
  if (d.commissionMaxCents) return `Up to ${f(d.commissionMaxCents)}`;
  return "Ask";
}

export function waitLabel(d: DeskInfo): string {
  const days = d.commissionDays;
  if (!days) return "Ask";
  if (days <= 10) return `~${days} days`;
  const weeks = Math.round(days / 7);
  return `~${weeks} week${weeks === 1 ? "" : "s"}`;
}

/**
 * The commission desk, stated plainly: what it costs, how long it takes,
 * and whether the artist is even taking work. Custom work's real friction
 * is uncertainty — this removes it before anyone has to send a DM. Fields
 * the artist hasn't set read "Ask" rather than inventing a number.
 */
export default function CommissionDesk({ desk, compact = false }: { desk: DeskInfo; compact?: boolean }) {
  const wallet = useMoney();
  const stated = desk.commissionMinCents || desk.commissionDays;

  if (compact) {
    return (
      <span className="tag text-smoke">
        {desk.commissionOpen ? (
          <span className="text-volt">● Taking work</span>
        ) : (
          <span className="text-smoke">○ Booked out</span>
        )}
        {stated && (
          <>
            {" · "}
            {priceLabel(desk, wallet)}
            {desk.commissionDays ? ` · ${waitLabel(desk)}` : ""}
          </>
        )}
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="tag text-volt">Commission desk</p>
        <span
          className={`rounded-full border px-2.5 py-1 tag ${
            desk.commissionOpen ? "border-volt text-volt" : "border-edge text-smoke"
          }`}
        >
          {desk.commissionOpen ? "● Taking work" : "○ Booked out"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <p className="tag text-smoke">Price</p>
          <p className="text-lg font-bold text-white">{priceLabel(desk, wallet)}</p>
        </div>
        <div>
          <p className="tag text-smoke">Turnaround</p>
          <p className="text-lg font-bold text-white">{waitLabel(desk)}</p>
        </div>
        {desk.commissionSlots ? (
          <div>
            <p className="tag text-smoke">Open slots</p>
            <p className="text-lg font-bold text-white">{desk.commissionSlots}</p>
          </div>
        ) : null}
      </div>

      {!stated && (
        <p className="mt-3 text-xs text-smoke">
          This maker hasn&apos;t posted rates yet — send a request and they&apos;ll quote you.
        </p>
      )}
    </div>
  );
}
