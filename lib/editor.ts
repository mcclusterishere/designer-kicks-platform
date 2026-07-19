import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

/**
 * The Editor Desk privilege. An EDITOR is a normal member account with the
 * role flag set — they get the scoped /editor desk (content, cross-posting,
 * mild outreach, messaging the office) but never the admin panel. Admins
 * can do everything an editor can, so admin access satisfies these too.
 */
export type SessionUserRole = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

export async function currentUserRole(): Promise<SessionUserRole | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true },
  });
}

export async function isEditor(): Promise<boolean> {
  const u = await currentUserRole();
  return u?.role === "EDITOR";
}

/** Editor Desk access = the editor role OR admin. */
export async function editorDeskOk(): Promise<boolean> {
  if (await isEditor()) return true;
  return isAdmin();
}
