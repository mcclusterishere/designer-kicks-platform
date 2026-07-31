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

/**
 * May we hand Meta-sourced content to Google?
 *
 * Meta's Platform Terms define Platform Data to include anything
 * "derived from" data we obtain from them, so a Gemini description of
 * a commenter's photo is itself Platform Data. Sharing it with a third
 * party is only permitted where that party acts as our Service
 * Provider, processing it "solely for you and at your direction and
 * for no other purpose, including for the Service Provider's own
 * purposes". Google's UNPAID Gemini tier uses prompts and images to
 * improve Google products, which is the provider's own purpose, and
 * that is the clause this would break.
 *
 * Setting META_SERVICE_PROVIDER_ATTESTED is the owner stating that the
 * key is on a paid tier with the data-processing terms in place. It
 * verifies nothing on its own — it is a deliberate, human act of
 * attestation, and this comment is here so nobody later mistakes it
 * for a check.
 *
 * Only the commenter-photo path is hard-gated on this today. Somebody
 * else's face or living room going to a third party is a different
 * order of exposure than our own post caption, and it is new, so
 * gating it breaks nothing that already worked.
 */
export function platformDataAllowed(): boolean {
  return Boolean(process.env.META_SERVICE_PROVIDER_ATTESTED);
}

/**
 * The model ladder, newest and cheapest first.
 *
 * gemini-2.0-flash was in this list as the safety net until it was shut
 * down on 1 June 2026, which made the net a guaranteed second failure.
 * gemini-2.5-flash is scheduled to shut down 16 October 2026, so it is
 * a backstop now, not a default.
 *
 * The flash-lite tier does text AND vision at one input rate, so the
 * sneaker-photo call rides the same cheap model as the comment replies
 * and no two-model split is needed.
 *
 * HONESTY NOTE: the two lite ids could not be called from the machine
 * this was written on, because the sandbox blocks every Google host.
 * They are ordered ahead of the known-good model precisely so that
 * being wrong costs one failed request rather than an outage: the
 * caller falls through the ladder and 2.5-flash still answers. Pin
 * GEMINI_MODEL to skip the ladder entirely.
 */
const MODEL_LADDER = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-2.5-flash"];

/**
 * Whichever rung actually answered last. Without this, a dead id at the
 * top of the ladder taxes EVERY call with a wasted round trip for the
 * life of the process. One failure is a probe; a thousand is a latency
 * bug.
 */
let workingModel: string | null = null;

/**
 * The one model id to use when a caller builds its own request instead
 * of going through geminiJson. There should be one place a model id
 * lives, and this is it.
 */
export function defaultModel(): string {
  return process.env.GEMINI_MODEL || workingModel || MODEL_LADDER[0];
}

function modelLadder(): string[] {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL];
  if (!workingModel) return MODEL_LADDER;
  return [workingModel, ...MODEL_LADDER.filter((m) => m !== workingModel)];
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

  const models = modelLadder();
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
        workingModel = model;
        break;
      } catch (e1) {
        if (opts.search) {
          try {
            data = await call(model, false);
            workingModel = model;
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

  const models = modelLadder();
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
        workingModel = model;
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
