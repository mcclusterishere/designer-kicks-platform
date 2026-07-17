import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

function csvCell(v: string | null | undefined): string {
  const s = v ?? "";
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { votes: true, giveawayEntries: true, quizRuns: true } },
    },
  });

  const header = "name,email,phone,city,shoe_size,favorite_silhouette,favorite_brands,style_interests,instagram,marketing_opt_in,credits,votes,giveaway_entries,quiz_runs,joined";
  const rows = users.map((u) =>
    [
      csvCell(u.name),
      csvCell(u.email),
      csvCell(u.phone),
      csvCell(u.city),
      csvCell(u.shoeSize),
      csvCell(u.favoriteSilhouette),
      csvCell(u.favoriteBrands),
      csvCell(u.styleInterests),
      csvCell(u.instagram),
      u.marketingOptIn ? "yes" : "no",
      String(u.credits),
      String(u._count.votes),
      String(u._count.giveawayEntries),
      String(u._count.quizRuns),
      u.createdAt.toISOString().slice(0, 10),
    ].join(",")
  );

  return new NextResponse([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="designer-kicks-users.csv"`,
    },
  });
}
