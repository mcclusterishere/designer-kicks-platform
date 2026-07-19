import { NextRequest, NextResponse } from "next/server";
import { allowAttempt } from "@/lib/ratelimit";

/**
 * The "selling advisor" — a Claude chat that helps artists figure out where
 * and how to sell their customs. DORMANT until ANTHROPIC_API_KEY is set:
 * with no key it returns a friendly fallback and never calls out, so the
 * Selling Hub ships free and the chat lights up when the key lands in env.
 *
 * Env: ANTHROPIC_API_KEY (required to turn it on), ADVISOR_MODEL (optional,
 * defaults to Haiku — cheap + fast, right for an advisor).
 */
const SYSTEM = `You are the Selling Advisor for The Heat Chart, a home for custom-sneaker artists.
You help artists who make one-of-one custom sneakers figure out how to sell their work: which platforms fit them (eBay, Shopify, Etsy, Depop, Grailed, StockX, GOAT, Instagram, their own site), how to price customs, how to shoot and describe a pair, shipping, and turning followers into buyers.
Be concrete, encouraging, and street-smart — you know sneaker culture. Keep answers short and practical, a few sentences or a tight list. If someone has no shop yet, walk them to the simplest first step. Stay on selling/business topics; if asked something off-topic, steer back warmly. Never invent fees, policies, or numbers you're unsure of — say "check the platform" instead.`;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({
      dormant: true,
      reply:
        "The AI advisor isn't switched on yet — but the platform guides on this page will get you started, and you can always message the league office for a human hand.",
    });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!allowAttempt("advisor", ip, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ reply: "You've hit the hourly limit — try again a little later." });
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const raw = Array.isArray(body.messages) ? body.messages : [];
  // Sanitize: last 16 turns, roles only, non-empty strings, capped length.
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

  const model = process.env.ADVISOR_MODEL || "claude-haiku-4-5-20251001";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: 700, system: SYSTEM, messages }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error("[advisor] Anthropic error", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ reply: "The advisor is catching its breath — try again in a sec." });
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const reply = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
    return NextResponse.json({ reply: reply || "Say a bit more and I'll help you sell it." });
  } catch (e) {
    console.error("[advisor] fetch error", e);
    return NextResponse.json({ reply: "Couldn't reach the advisor just now — the guides below still have you covered." });
  }
}
