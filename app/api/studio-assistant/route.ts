import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getStudioData } from "@/lib/analytics";
import { getHeatList } from "@/lib/battles";
import { allowAttempt } from "@/lib/ratelimit";
import { geminiChat, geminiConfigured, type ChatTurn } from "@/lib/gemini";

/**
 * The Studio Assistant — a Gemini chat only APPROVED artists can reach,
 * grounded in THEIR own numbers (record, votes, followers, heat rank,
 * pieces) so its advice is about them, not generic. Helps with pricing,
 * bios, what to post, how to climb the chart, selling. Dormant with a
 * friendly fallback until GEMINI_API_KEY is set.
 */
type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const profile = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true, displayName: true, bio: true, city: true, instagram: true },
  });
  if (!profile || profile.status !== "APPROVED") {
    return NextResponse.json({ error: "Artist accounts only." }, { status: 403 });
  }

  if (!allowAttempt("studio-assistant", session.user.id, 40, 60 * 60 * 1000)) {
    return NextResponse.json({ reply: "You've hit the hourly limit — back in a bit." });
  }

  if (!geminiConfigured()) {
    return NextResponse.json({
      dormant: true,
      reply:
        "Your assistant switches on once the league adds its AI key. In the meantime, your Studio numbers below tell the story — and the office is a message away.",
    });
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: Msg[] = raw
    .slice(-16)
    .filter(
      (m): m is Msg =>
        !!m &&
        typeof m === "object" &&
        ((m as Msg).role === "user" || (m as Msg).role === "assistant") &&
        typeof (m as Msg).content === "string" &&
        (m as Msg).content.trim().length > 0
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Say something first." }, { status: 400 });
  }

  // Ground the assistant in this artist's real standing.
  let context = `Artist: ${profile.displayName}`;
  try {
    const [data, heat] = await Promise.all([getStudioData(profile.id), getHeatList()]);
    if (data) {
      const rank = new Map(heat.map((h, i) => [h.id, i + 1]));
      const best = Math.min(...data.artist.submissions.map((s) => rank.get(s.id) ?? Infinity));
      const pieces = data.artist.submissions
        .map((s) => `"${s.title}"${rank.get(s.id) ? ` (heat #${rank.get(s.id)})` : ""}`)
        .join(", ");
      context =
        `Artist: ${profile.displayName}${profile.city ? ` from ${profile.city}` : ""}. ` +
        `Instagram: @${profile.instagram ?? "not set"}. ` +
        `Record: ${data.stats.wins}W-${data.stats.losses}L. Total votes: ${data.stats.totalVotes}. ` +
        `Followers: ${data.stats.followers}. Profile views: ${data.stats.views}. ` +
        `${Number.isFinite(best) ? `Best heat rank: #${best}. ` : ""}` +
        `Rate-game score: ${data.stats.avgRating ?? "—"}/5. ` +
        `Pieces: ${pieces || "none yet"}. ` +
        `Current bio: ${profile.bio ? `"${profile.bio}"` : "empty"}.`;
    }
  } catch {
    /* context is best-effort — a bare greeting still helps */
  }

  const SYSTEM = `You are the Studio Assistant for The Heat Chart, a battle-league platform for custom-sneaker artists. You advise ONE artist, privately, in their Studio. You know their real standing:

${context}

How the platform works: artists post one-of-one customs; the culture votes in head-to-head battles; wins and votes drive a per-piece Heat Index and the league rankings (Heat List); pieces trade on the Market where the artist earns a royalty on every resale, forever. Artists set asks, take offers, run drops, and link their shops.

Your job: help THIS artist grow — pricing their work, writing bios and captions, deciding what to post, how to win more battles and climb the chart, shooting better photos, and turning followers into buyers. Use their real numbers above to make advice specific ("your Afro Samurai piece is #2 — lead with it"). Be concrete, encouraging, street-smart about sneaker culture. Keep it short: a few sentences or a tight list. Never invent fees, sales, or platform policies you're unsure of. If asked to change their profile, tell them where in the Studio to do it — you advise, you don't edit.`;

  const history: ChatTurn[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    text: m.content,
  }));

  const reply = await geminiChat({ system: SYSTEM, history });
  return NextResponse.json({
    reply: reply ?? "Couldn't reach your assistant just now — try again in a sec.",
  });
}
