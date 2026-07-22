"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { deleteMyAccount } from "@/app/actions";

/**
 * Self-serve account deletion (App Store 5.1.1(v)). Two-step confirm:
 * open the panel, type DELETE, gone. Wipes personal data server-side,
 * then signs the browser out and lands on the home page.
 */
export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="mt-10 rounded-xl border border-heat/40 bg-surface p-5">
      <h2 className="display text-xl text-white">Delete account</h2>
      <p className="mt-1.5 text-sm text-smoke">
        Permanently removes your personal info (name, email, passport
        details) and disables sign-in — including any linked social
        logins. Battle results stay in the league records as anonymous
        votes; your comments will show as “Deleted Member.” This cannot
        be undone.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tag mt-4 rounded-lg border border-heat/60 px-4 py-2.5 font-bold text-heat transition hover:bg-heat/10"
        >
          Delete my account
        </button>
      ) : (
        <div className="mt-4">
          <label className="tag text-smoke" htmlFor="delete-confirm">
            Type DELETE to confirm
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="delete-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              className="min-w-0 flex-1 rounded-lg border border-edge bg-panel px-3 py-2.5 text-white placeholder:text-smoke/50 focus:border-heat focus:outline-none"
            />
            <button
              type="button"
              disabled={pending || confirm !== "DELETE"}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const res = await deleteMyAccount(confirm);
                  if (res.ok) {
                    await signOut({ callbackUrl: "/" });
                  } else {
                    setError(res.error ?? "Something went wrong.");
                  }
                })
              }
              className="tag shrink-0 rounded-lg bg-heat px-4 py-2.5 font-bold text-ink disabled:opacity-40"
            >
              {pending ? "Deleting…" : "Confirm"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-heat">{error}</p>}
        </div>
      )}
    </section>
  );
}
