/**
 * Shared Gemini client — one key powers every assist on the site.
 *
 * Same dormant-until-key contract as the rest of the integrations: with
 * no GEMINI_API_KEY set, geminiConfigured() is false and geminiJson()
 * resolves null without a single outbound call. GEMINI_MODEL overrides
 * the model, GEMINI_API_URL overrides the endpoint (used by tests).
 */

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function extractJson(text: string): unknown | null {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * One call, JSON out. `search: true` adds Google Search grounding (and
 * quietly retries without it — some keys/models reject tools). Returns
 * null on any failure; callers always have a non-AI fallback.
 */
export async function geminiJson<T = unknown>(opts: {
  system: string;
  parts: GeminiPart[];
  search?: boolean;
  temperature?: number;
  timeoutMs?: number;
}): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const apiKey: string = key; // narrowed copy visible inside call()

  // Newest capable model first; the older flash stays as a safety net
  // for keys/regions that don't serve it yet. GEMINI_MODEL pins one.
  const models = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : ["gemini-2.5-flash", "gemini-2.0-flash"];
  const apiBase = process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com";
  const body = {
    system_instruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: { temperature: opts.temperature ?? 0.3 },
  };

  async function call(model: string, withTools: boolean) {
    const url = `${apiBase}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const payload = withTools ? { ...body, tools: [{ google_search: {} }] } : body;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }

  try {
    let data;
    let lastErr: unknown = null;
    for (const model of models) {
      try {
        data = await call(model, Boolean(opts.search));
        break;
      } catch (e1) {
        if (opts.search) {
          try {
            data = await call(model, false);
            break;
          } catch (e2) {
            lastErr = e2;
            continue;
          }
        }
        lastErr = e1;
      }
    }
    if (!data) throw lastErr ?? new Error("Gemini: all models failed");
    const text: string =
      (data?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim() || "";
    return (extractJson(text) as T) ?? null;
  } catch (e) {
    console.error("[gemini]", e);
    return null;
  }
}

/** Files → inline image parts, newest-first capped so requests stay small. */
export async function imageParts(files: File[], maxTotalBytes = 9_000_000): Promise<GeminiPart[]> {
  const parts: GeminiPart[] = [];
  let total = 0;
  for (const f of files) {
    if (!f || f.size === 0 || !f.type.startsWith("image/")) continue;
    if (total + f.size > maxTotalBytes) break;
    total += f.size;
    parts.push({
      inlineData: { mimeType: f.type, data: Buffer.from(await f.arrayBuffer()).toString("base64") },
    });
    if (parts.length >= 3) break; // three angles is plenty to identify a shoe
  }
  return parts;
}

/**
 * Multi-turn plain-text chat (the artist assistant runs on this).
 * Same key/model-fallback contract as geminiJson — returns null when
 * dormant or on any failure, so the caller always has a graceful
 * fallback. `history` is the running conversation (user/model turns).
 */
export type ChatTurn = { role: "user" | "model"; text: string };

export async function geminiChat(opts: {
  system: string;
  history: ChatTurn[];
  temperature?: number;
  timeoutMs?: number;
}): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const apiKey: string = key;

  const models = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : ["gemini-2.5-flash", "gemini-2.0-flash"];
  const apiBase = process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com";
  const body = {
    system_instruction: { parts: [{ text: opts.system }] },
    contents: opts.history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: { temperature: opts.temperature ?? 0.6, maxOutputTokens: 800 },
  };

  async function call(model: string) {
    const url = `${apiBase}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }

  try {
    let data;
    let lastErr: unknown = null;
    for (const model of models) {
      try {
        data = await call(model);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!data) throw lastErr ?? new Error("Gemini chat: all models failed");
    const text: string =
      (data?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim() || "";
    return text || null;
  } catch (e) {
    console.error("[gemini chat]", e);
    return null;
  }
}
