"use client";

import { useState } from "react";
import { resendClaimLink } from "@/app/actions";

export type Handoff = {
  saleId: string;
  title: string;
  imageUrl: string;
  buyerEmail: string;
  priceCents: number;
  daysWaiting: number;
  stale: boolean;
  claimUrl: string;
  message: string;
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** Masked so a shoulder-surfer or a screenshot doesn't spread a buyer's address. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="tag rounded-md border border-edge px-3 py-2 text-white transition hover:border-volt"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

/**
 * Waiting on your buyer.
 *
 * Every sale here is money that already changed hands in real life and a
 * piece that isn't officially anybody's yet. That matters to the artist
 * more than it looks: an unclaimed sale isn't on their record, doesn't
 * count toward their sales history, and can never be resold — so the
 * piece drops out of the market entirely.
 *
 * Two ways out, because artists sell in two places. The buyer already
 * got an email automatically; this offers a resend for the ones who
 * missed it, and a written-out DM for the ones who only answer Instagram.
 */
export default function HandoffDesk({ items }: { items: Handoff[] }) {
  if (items.length === 0) return null;

  const stale = items.filter((i) => i.stale);

  return (
    <section className="mt-8 rounded-xl border border-heat/40 bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl text-white">Waiting on your buyer</h2>
        <p className="tag text-smoke">
          {items.length} unclaimed{stale.length > 0 && ` · ${stale.length} overdue`}
        </p>
      </div>
      <p className="mt-1 text-xs text-smoke">
        These already sold — the buyer just hasn&apos;t claimed them yet. Until they do, the piece
        isn&apos;t on their shelf, it isn&apos;t on your sales record, and nobody can ever resell
        it. They were emailed a link automatically when you logged the sale.
      </p>

      <ul className="mt-4 space-y-3">
        {items.map((h) => (
          <li key={h.saleId} className="rounded-lg border border-edge bg-panel p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={h.imageUrl}
                  alt={h.title}
                  className="h-14 w-14 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate font-bold text-white">{h.title}</p>
                  <p className="mt-0.5 text-xs text-smoke">
                    {usd(h.priceCents)} · {maskEmail(h.buyerEmail)}
                  </p>
                  <p className="mt-0.5 text-xs">
                    {h.stale ? (
                      <span className="text-heat">
                        {h.daysWaiting} days waiting — worth a nudge
                      </span>
                    ) : (
                      <span className="text-smoke">
                        {h.daysWaiting === 0 ? "Logged today" : `${h.daysWaiting}d ago`}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-1.5">
                <CopyButton text={h.claimUrl} label="Copy link" />
                <form action={resendClaimLink}>
                  <input type="hidden" name="saleId" value={h.saleId} />
                  <button className="tag rounded-md border border-volt px-3 py-2 font-bold text-volt transition hover:bg-volt/10">
                    Email again
                  </button>
                </form>
              </div>
            </div>

            <details className="mt-2.5">
              <summary className="cursor-pointer tag text-smoke hover:text-white">
                Message to send them
              </summary>
              <pre className="mt-1.5 whitespace-pre-wrap rounded-md border border-edge bg-surface p-2.5 font-sans text-xs leading-relaxed text-smoke">
                {h.message}
              </pre>
              <div className="mt-1.5">
                <CopyButton text={h.message} label="Copy message" />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
