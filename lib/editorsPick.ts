import { prisma } from "./db";

/**
 * The Editor's Pick — the house's hand-chosen designer, independent of the
 * Heat List ranking. Exactly one artist wears it (enforced in seed). Returns
 * null when nobody's anointed so the spotlight can simply not render.
 */
export type EditorsPick = {
  slug: string;
  displayName: string;
  bio: string | null;
  note: string | null;
  city: string | null;
  instagram: string | null;
  heroImage: string | null;
  pieceCount: number;
};

export async function getEditorsPick(): Promise<EditorsPick | null> {
  const a = await prisma.artistProfile.findFirst({
    where: { editorsPick: true, status: "APPROVED" },
    select: {
      slug: true,
      displayName: true,
      bio: true,
      editorialNote: true,
      city: true,
      instagram: true,
      submissions: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { imageUrl: true },
      },
      _count: { select: { submissions: { where: { status: "APPROVED" } } } },
    },
  });
  if (!a) return null;
  return {
    slug: a.slug,
    displayName: a.displayName,
    bio: a.bio,
    note: a.editorialNote,
    city: a.city,
    instagram: a.instagram,
    heroImage: a.submissions[0]?.imageUrl ?? null,
    pieceCount: a._count.submissions,
  };
}
