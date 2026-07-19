/**
 * The Onboarding Agent — turns social links + a few hints into a
 * pre-filled artist profile draft, so an editor can preload a whole page
 * in one step instead of typing everything.
 *
 * Backed by Google's Gemini (free tier is generous) with Search grounding,
 * plus a best-effort fetch of each link's OpenGraph meta for real context.
 * DORMANT until GEMINI_API_KEY is set — with no key it returns a clear
 * "off" result and makes zero outbound calls, so the feature ships free and
 * lights up the moment a key lands in the environment.
 *
 * Env: GEMINI_API_KEY (required to turn it on), GEMINI_MODEL (optional,
 * defaults to gemini-2.0-flash).
 */

export type ProfileDraft = {
  displayName: string | null;
  instagram: string | null; // handle, no @
  city: string | null;
  bio: string | null; // 1–2 sentences, their story
  specialty: string | null; // what they make — "AF1 hand-paints", "Jordan swaps"
  portfolioUrl: string | null; // website / linktree / shop
  suggestedEmail: string | null; // only if clearly public; else null
  outreachAngle: string | null; // one line: why they'd fit The Heat Chart
  confidence: "low" | "medium" | "high";
  sources: string[]; // urls the facts came from
};

export function onboardAgentConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const OG_TIMEOUT = 6000;

/** Best-effort: pull title/description from each link so the model has real context. */
async function gatherLinkContext(links: string[]): Promise<string> {
  const parts: string[] = [];
  await Promise.all(
    links.slice(0, 5).map(async (url) => {
      try {
        const res = await fetch(url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; HeatChartBot/1.0)" },
          signal: AbortSignal.timeout(OG_TIMEOUT),
        });
        if (!res.ok) return;
        const html = (await res.text()).slice(0, 200_000);
        const grab = (prop: string) =>
          html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
          html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1];
        const title = grab("og:title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
        const desc = grab("og:description") || grab("description");
        if (title || desc) parts.push(`URL ${url}\n  title: ${title ?? ""}\n  desc: ${desc ?? ""}`);
      } catch {
        /* blocked / offline — the model can still use Search + the URL itself */
      }
    })
  );
  return parts.join("\n");
}

const SYSTEM = `You research custom-sneaker artists for The Heat Chart, a platform where customizers showcase and battle their work.
Given social links and hints about ONE artist, find public facts and fill in a profile. Use search and the provided page context.
Rules:
- ONLY use publicly visible facts. Never invent a name, city, email, or handle you can't support. When unsure, use null.
- instagram is just the handle (no @, no url). specialty is what they make (e.g. "AF1 hand-paints"). bio is 1-2 sentences in their voice, no hype filler.
- suggestedEmail: only if a real contact email is clearly public; otherwise null.
- outreachAngle: one short line an editor could open a DM with.
- confidence reflects how much you actually found. List the source URLs you used.
Return ONLY a JSON object, no markdown fences, with exactly these keys:
{"displayName":string|null,"instagram":string|null,"city":string|null,"bio":string|null,"specialty":string|null,"portfolioUrl":string|null,"suggestedEmail":string|null,"outreachAngle":string|null,"confidence":"low"|"medium"|"high","sources":string[]}`;

function coerceDraft(obj: unknown): ProfileDraft {
  const o = (obj ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const conf = o.confidence;
  return {
    displayName: str(o.displayName),
    instagram: str(o.instagram)?.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "") ?? null,
    city: str(o.city),
    bio: str(o.bio),
    specialty: str(o.specialty),
    portfolioUrl: str(o.portfolioUrl),
    suggestedEmail: str(o.suggestedEmail),
    outreachAngle: str(o.outreachAngle),
    confidence: conf === "high" || conf === "medium" || conf === "low" ? conf : "low",
    sources: Array.isArray(o.sources) ? o.sources.filter((s): s is string => typeof s === "string").slice(0, 8) : [],
  };
}

export async function researchProfile(input: {
  links: string[];
  hints?: string;
}): Promise<{ ok: true; draft: ProfileDraft } | { ok: false; dormant?: boolean; error: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { ok: false, dormant: true, error: "The research agent is off — add GEMINI_API_KEY to switch it on." };
  }
  const links = input.links.map((l) => l.trim()).filter(Boolean).slice(0, 5);
  if (links.length === 0 && !input.hints?.trim()) {
    return { ok: false, error: "Add at least one link or a hint." };
  }

  const context = await gatherLinkContext(links);
  const userPrompt = [
    `Links:\n${links.map((l) => `- ${l}`).join("\n") || "(none)"}`,
    input.hints?.trim() ? `Hints from the editor:\n${input.hints.trim()}` : "",
    context ? `Page context we fetched:\n${context}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const apiBase = process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com";
  const url = `${apiBase}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.3 },
  };

  async function call(withTools: boolean) {
    const payload = withTools ? body : { ...body, tools: undefined };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }

  try {
    let data;
    try {
      data = await call(true); // with Search grounding
    } catch {
      data = await call(false); // some keys/models reject the tool — retry plain
    }
    const text: string =
      (data?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim() || "";
    const jsonStr = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start === -1 || end === -1) return { ok: false, error: "The agent didn't return a usable result — try again." };
    const parsed = JSON.parse(jsonStr.slice(start, end + 1));
    return { ok: true, draft: coerceDraft(parsed) };
  } catch (e) {
    console.error("[onboardAgent]", e);
    return { ok: false, error: "Couldn't reach the research agent just now — try again in a moment." };
  }
}
