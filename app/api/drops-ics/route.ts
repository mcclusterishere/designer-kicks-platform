import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/articles";

export const dynamic = "force-dynamic";

function dropName(title: string): string {
  return title.split(/[—:|]/)[0].trim();
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/**
 * The whole drop calendar as one subscribable ICS feed — add it to
 * Apple/Google/Outlook once and every drop (and every future update)
 * shows up automatically. The feature paid calendars gate, free.
 */
export async function GET() {
  const drops = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      dropAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
    },
    orderBy: { dropAt: "asc" },
    take: 120,
  });
  const ymd = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const stamp = `${ymd(new Date())}T000000Z`;
  const events = drops.flatMap((a) => {
    const next = new Date(a.dropAt!.getTime() + 24 * 3600 * 1000);
    const url = `${siteUrl()}/news/${a.slug}`;
    return [
      "BEGIN:VEVENT",
      `UID:drop-${a.id}@theheatchart.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(a.dropAt!)}`,
      `DTEND;VALUE=DATE:${ymd(next)}`,
      `SUMMARY:${esc(`${dropName(a.title)} — drop day`)}`,
      `DESCRIPTION:${esc(`${a.excerpt}\nThe story + raffle links: ${url}`)}`,
      `URL:${url}`,
      "END:VEVENT",
    ];
  });
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Heat Chart//Drop Calendar//EN",
    "X-WR-CALNAME:The Heat Chart — Drops",
    "X-WR-CALDESC:Every sneaker release date + the story behind it. theheatchart.com/drops",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="theheatchart-drops.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
