/**
 * Who is allowed to be who.
 *
 * The ownership rules live in lib/ownership.ts because they are about a
 * piece. These two are about an identity, and they exist as named
 * predicates rather than inline conditions for one reason: both of them
 * were wrong, and both were wrong in the same way — a form field was
 * being treated as proof of who was filling it in.
 *
 * Deliberately dependency-free. Pure functions, no prisma, no session,
 * so the rule can be tested directly instead of only through the action
 * that happens to call it.
 */

/** Anything above a plain member seat. Roles are strings in the schema. */
export function isStaffRole(role: string | null | undefined): boolean {
  const r = (role ?? "").trim().toUpperCase();
  return r !== "" && r !== "MEMBER";
}

export type AdoptableRow = {
  role?: string | null;
  passwordHash?: string | null;
} | null;

/**
 * May a signup form attach a password to this pre-existing row?
 *
 * Passwordless rows are normal here: one exists for every pre-loaded
 * artist page, and registering with its address is how a maker takes
 * their page over. `grantEditor` creates the same shape — a passwordless
 * row — except with a staff role on it, and mails its holder a
 * set-password link.
 *
 * That collision was the bug. Signup adopted the row and wrote a password
 * without touching `role`, so registering with a known staff address
 * produced an account that came out of the form already an editor. From
 * there `outreachInvite` reassigns unclaimed artist pages and returns the
 * claim URL, which turns one guessed work address into a roster takeover.
 *
 * A staff member who lost their link uses password recovery, which proves
 * the mailbox. Signup does not.
 */
export function mayAdoptExistingAccount(existing: AdoptableRow): boolean {
  if (!existing) return true;
  return !isStaffRole(existing.role);
}

/**
 * Does the signed-in session prove this email address?
 *
 * Typing an address into an unauthenticated form asserts it; it does not
 * prove it. Anywhere a match on that field grants write access to
 * something already filed under it, this is the question being asked —
 * and the honest answer is no whenever there is no session.
 */
export function provesEmail(
  sessionEmail: string | null | undefined,
  claimedEmail: string | null | undefined
): boolean {
  const a = (sessionEmail ?? "").trim().toLowerCase();
  const b = (claimedEmail ?? "").trim().toLowerCase();
  return a !== "" && a === b;
}
