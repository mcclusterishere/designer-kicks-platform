"use client";

import { useActionState } from "react";
import { importContactsAction, type ActionResult } from "@/app/actions";

export default function ContactImport() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    importContactsAction,
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      <input
        type="file"
        name="file"
        accept=".csv,text/csv,text/plain"
        required
        aria-label="Contacts CSV file"
        className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-volt file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-ink"
      />

      {state && !state.ok && (
        <p role="alert" className="rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded border border-volt/40 bg-volt/10 px-3 py-2 text-sm text-volt">
          {state.note ?? "Imported."}
        </p>
      )}

      <button
        disabled={pending}
        className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
      >
        {pending ? "Reading the file…" : "Import contacts"}
      </button>

      {/* Where the file comes from, because "export a CSV" is not an
          instruction most people have followed before. */}
      <details className="pt-1">
        <summary className="cursor-pointer tag text-smoke hover:text-white">
          How do I get the file?
        </summary>
        <ul className="mt-2 space-y-1.5 text-xs text-smoke">
          <li>
            <span className="text-white">iPhone</span> — open Contacts, tap Lists, long-press a
            list and choose Export. Or email yourself a vCard and convert it to CSV.
          </li>
          <li>
            <span className="text-white">Google / Gmail</span> — contacts.google.com → Export →
            Google CSV.
          </li>
          <li>
            <span className="text-white">Shopify</span> — Customers → Export → CSV for Excel.
          </li>
          <li>
            <span className="text-white">A spreadsheet you typed</span> — a Name column is the only
            thing required. Email, Phone, Instagram, City and Notes are picked up if they&apos;re
            there.
          </li>
        </ul>
      </details>
    </form>
  );
}
