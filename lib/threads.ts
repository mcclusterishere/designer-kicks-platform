/**
 * Threads recruitment autoposter — the "Day N" engine.
 *
 * The manual version of this pulled 20-40 engagements a post before it
 * stopped for the only reason these things stop: posting every day by
 * hand is a grind. This automates exactly what worked: a short
 * numbered-day recruitment post, every day, forever, pointing at the
 * ambassador program with a tracked link.
 *
 * Uses Meta's official Threads API (graph.threads.net): create a text
 * container, publish it. Dormant until:
 *   THREADS_USER_ID      (numeric id of @kickequipped on Threads)
 *   THREADS_ACCESS_TOKEN (long-lived token w/ threads_content_publish)
 *   THREADS_API_URL      (test override)
 */

import { proofParams } from "./appsecret";

const THREADS_API = process.env.THREADS_API_URL || "https://graph.threads.net/v1.0";

/** House Threads token is minted by the Threads app, so it signs. */
function threadsProof(token: string): Record<string, string> {
  return proofParams(token, process.env.THREADS_APP_SECRET);
}

// Day 1 of the automated era. The escalating day count is social
// proof — it says "this program is alive" without saying it.
const PROGRAM_START = Date.UTC(2026, 6, 21); // July 21, 2026

/**
 * Env-only, kept synchronous because it is what the pasted-token setup
 * looks like and several call sites read it inline.
 */
export function threadsConfigured(): boolean {
  return Boolean(process.env.THREADS_USER_ID && process.env.THREADS_ACCESS_TOKEN);
}

export type ThreadsCreds = { userId: string; token: string; source: "env" | "connection" };

/**
 * Where the house Threads credentials actually come from.
 *
 * Two routes exist and only one of them used to be read here. Pasting
 * THREADS_USER_ID and THREADS_ACCESS_TOKEN into Railway worked;
 * clicking "Connect Threads" in the admin — which runs the real OAuth
 * and stores the token on SocialAccount — did not, because this module
 * only ever looked at the environment. The symptom is the worst kind:
 * the connection succeeds, the admin shows the channel connected, and
 * the daily poster still reports itself dormant.
 *
 * Env wins when present, so a deliberately pasted token still overrides
 * everything. Otherwise the stored connection answers.
 *
 * The stored route is also the durable one. A hand-pasted Threads token
 * lasts ~60 days and, once lapsed, cannot be refreshed at all — it has
 * to be minted again by hand. The connection carries its expiry and is
 * refreshed lazily at publish time, so it heals itself.
 */
export async function threadsCredentials(): Promise<ThreadsCreds | null> {
  const envUser = process.env.THREADS_USER_ID;
  const envToken = process.env.THREADS_ACCESS_TOKEN;
  if (envUser && envToken) return { userId: envUser, token: envToken, source: "env" };

  try {
    const { prisma } = await import("./db");
    // The house account is whichever Threads channel the OWNER
    // connected. A fan's or an editor's connection must never be posted
    // from — this is the account that speaks as the brand.
    //
    // Identity comes from lib/admin's allowlist rather than from a role
    // column, because there is no admin role: User.role is MEMBER or
    // EDITOR, and admin is the password gate plus an owner email. A
    // role check here would have compiled, run, matched nothing, and
    // left the fallback quietly dead.
    const { adminAllowlist } = await import("./admin");
    const owners = adminAllowlist();
    if (owners.length === 0) return null;

    const row = await prisma.socialAccount.findFirst({
      where: {
        provider: "threads",
        status: "ACTIVE",
        user: { email: { in: owners, mode: "insensitive" } },
      },
      orderBy: { connectedAt: "desc" },
      select: { accountId: true, accessToken: true },
    });
    if (!row?.accountId || !row.accessToken) return null;
    return { userId: row.accountId, token: row.accessToken, source: "connection" };
  } catch {
    // A database hiccup must not be reported as "not connected".
    return null;
  }
}

/** Is the house Threads channel usable at all, by either route? */
export async function threadsReady(): Promise<boolean> {
  return (await threadsCredentials()) !== null;
}

export function programDay(now: Date = new Date()): number {
  return Math.max(1, Math.floor((now.getTime() - PROGRAM_START) / 86_400_000) + 1);
}

// The rotation — every variant is a proven pattern from the manual
// run (models/ambassadors, local-designer collab, private-club) with
// the link the manual posts never had. Short on purpose: the short
// ones pulled hardest.
const LINK = "theheatchart.com/ambassadors?utm_source=threads&utm_medium=autopost&utm_campaign=ambassadors";

export const THREADS_DECK: ((day: number) => string)[] = [
  (d) => `Day ${d} — looking for models & brand ambassadors for the league. Free pro shoots with top sneaker customizers, shots go out to 300k+. The shoot IS the audition. ${LINK}`,
  (d) => `Day ${d} of building the model roster. If you understand fashion, we have free shoots, credited posts to 300k followers, and a path to running curation for the league. ${LINK}`,
  (d) => `Day ${d} — models: your next portfolio shoot is free if you can pass a fashion IQ check. One-of-one custom sneakers, real photographers, full credit. ${LINK}`,
  (d) => `Looking for fashion designers & customizers in Georgia who want their work shot and showcased — we have 300k on FB. Models get the shoot free. Day ${d}. ${LINK}`,
  (d) => `Day ${d} — brand ambassador program is open. Not "post for exposure": free shoots, credited placement, and top ambassadors become league curators with first pick of everything. ${LINK}`,
  (d) => `If you're a model, creator, or stylist who actually knows sneakers — the league is building its ambassador class. The quiz is the door. Day ${d}. ${LINK}`,
  (d) => `Day ${d} — free professional shoots for models in every city the league touches. Your audition is the shoot itself. Fashion IQ required, camera-ready optional. ${LINK}`,
  (d) => `Building a private class of models + curators around custom sneaker culture. Weekly drops, real shoots, real credit, first pick of opportunities. Day ${d}. ${LINK}`,
  (d) => `Day ${d} — customizers get free shoots of their pieces. Models get free portfolio work. The league gets the culture on camera. Everybody eats. ${LINK}`,
  (d) => `Models & ambassadors: stop paying for portfolio shoots. Pass the culture check, get booked when the league hits your city, get posted to 300k+. Day ${d}. ${LINK}`,
];

export function todaysPost(now: Date = new Date()): string {
  const day = programDay(now);
  return THREADS_DECK[(day - 1) % THREADS_DECK.length](day);
}

export type ThreadsResult = { ok: boolean; detail: string };

/**
 * Photo post on the house Threads account: create an IMAGE container,
 * wait for Meta to ingest the photo, publish. Threads counts the whole
 * text (link included) against its 500-character cap, so callers keep
 * captions short.
 */
export async function postImageToThreads(text: string, imageUrl: string): Promise<ThreadsResult> {
  const creds = await threadsCredentials();
  if (!creds) return { ok: false, detail: "Threads not connected" };
  try {
    const { userId, token } = creds;

    const createRes = await fetch(`${THREADS_API}/${userId}/threads`, {
      method: "POST",
      body: new URLSearchParams({ media_type: "IMAGE", image_url: imageUrl, text, access_token: token, ...threadsProof(token) }),
      signal: AbortSignal.timeout(15000),
    });
    const created = (await createRes.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };
    if (!createRes.ok || !created.id) {
      return { ok: false, detail: created.error?.message || `Threads create ${createRes.status}` };
    }

    // Image containers usually finish in seconds; give them a minute.
    for (let i = 0; i < 12; i++) {
      const statusRes = await fetch(
        `${THREADS_API}/${created.id}?fields=status_code&${new URLSearchParams({ access_token: token, ...threadsProof(token) })}`,
        { signal: AbortSignal.timeout(15000) }
      );
      const status = (await statusRes.json().catch(() => ({}))) as { status_code?: string };
      if (status.status_code === "FINISHED") break;
      if (status.status_code === "ERROR") {
        return { ok: false, detail: "Threads couldn't process the image" };
      }
      await new Promise((r) => setTimeout(r, 5000));
    }

    const publishRes = await fetch(`${THREADS_API}/${userId}/threads_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: created.id, access_token: token, ...threadsProof(token) }),
      signal: AbortSignal.timeout(15000),
    });
    const published = (await publishRes.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };
    if (!publishRes.ok || !published.id) {
      return { ok: false, detail: published.error?.message || `Threads publish ${publishRes.status}` };
    }
    return { ok: true, detail: `Posted to Threads (${published.id})` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Threads post failed" };
  }
}

/** Two-step publish: create the text container, then publish it. */
export async function postToThreads(text: string): Promise<ThreadsResult> {
  const creds = await threadsCredentials();
  if (!creds) return { ok: false, detail: "Threads not connected" };
  try {
    const { userId, token } = creds;

    const createRes = await fetch(`${THREADS_API}/${userId}/threads`, {
      method: "POST",
      body: new URLSearchParams({ media_type: "TEXT", text, access_token: token, ...threadsProof(token) }),
      signal: AbortSignal.timeout(15000),
    });
    const created = (await createRes.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };
    if (!createRes.ok || !created.id) {
      return { ok: false, detail: created.error?.message || `Threads create ${createRes.status}` };
    }

    const publishRes = await fetch(`${THREADS_API}/${userId}/threads_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: created.id, access_token: token, ...threadsProof(token) }),
      signal: AbortSignal.timeout(15000),
    });
    const published = (await publishRes.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };
    if (!publishRes.ok || !published.id) {
      return { ok: false, detail: published.error?.message || `Threads publish ${publishRes.status}` };
    }
    return { ok: true, detail: `Posted to Threads (${published.id})` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Threads post failed" };
  }
}
