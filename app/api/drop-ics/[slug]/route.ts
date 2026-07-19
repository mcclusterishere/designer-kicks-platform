import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/articles";

export const dynamic = "force-dynamic";

/** "AJ4 'Comic' — Release Date…" → the shoe name. */
function dropName(title: string): string {
  return title.split(/[—:|]/)[0].trim();
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

// A downloadable all-day calendar event for a drop — the "remind me"
// that paid calendars charge for. Works with Apple/Google/Outlook.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const a = await prisma.article.findUnique({ where: { slug } });
  if (!a || a.status !== "PUBLISHED" || !a.dropAt) {
    return NextResponse.json({ error: "No drop found" }, { status: 404 });
  }
  const ymd = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const next = new Date(a.dropAt.getTime() + 24 * 3600 * 1000);
  const name = dropName(a.title);
  const url = `${siteUrl()}/news/${a.slug}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Heat Chart//Drop Calendar//EN",
    "BEGIN:VEVENT",
    `UID:drop-${a.id}@theheatchart.com`,
    `DTSTAMP:${ymd(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${ymd(a.dropAt)}`,
    `DTEND;VALUE=DATE:${ymd(next)}`,
    `SUMMARY:${esc(`${name} — drop day`)}`,
    `DESCRIPTION:${esc(`${a.excerpt}\nThe story + raffle links: ${url}`)}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(`${name} drops today`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
