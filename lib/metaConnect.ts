import { prisma } from "./db";
import { siteUrl } from "./articles";
import { businessSecret, proofParams } from "./appsecret";

/**
 * The onboarding handshake: an editor clicks "Connect my Instagram",
 * signs in on Meta's page, and lands back here with their channel wired
 * for auto-promotion. This module owns both directions of that trip.
 *
 * Three providers, three OAuth dialects (none of them share a domain,
 * a scope-name family, or a token lifetime — that's Meta's shape, not
 * ours):
 *
 *   instagram      instagram.com/oauth/authorize
 *                  scopes instagram_business_basic,
 *                         instagram_business_content_publish
 *                  short token -> ig_exchange_token -> ~60 days
 *   threads        threads.net/oauth/authorize
 *                  scopes threads_basic, threads_content_publish
 *                  short token -> th_exchange_token -> ~60 days
 *   facebook_page  facebook.com/v23.0/dialog/oauth
 *                  scopes pages_show_list, pages_manage_posts
 *                  user token -> long-lived -> Page tokens (no expiry)
 *
 * What is deliberately NOT here: personal Facebook profiles. Meta
 * removed profile publishing from the API in 2018 and no permission
 * brings it back. Pages only.
 */

export type ConnectProvider = "instagram" | "threads" | "facebook_page";

export function isConnectProvider(p: string): p is ConnectProvider {
  return p === "instagram" || p === "threads" || p === "facebook_page";
}

const IG_API = process.env.IG_USER_API_URL || "https://graph.instagram.com/v23.0";
const IG_BASIC = process.env.IG_TOKEN_API_URL || "https://api.instagram.com";
const THREADS_API = process.env.THREADS_API_URL || "https://graph.threads.net/v1.0";
const THREADS_AUTH = process.env.THREADS_AUTH_URL || "https://threads.net";
const FB_API = process.env.GRAPH_API_URL || "https://graph.facebook.com/v23.0";
const FB_AUTH = process.env.FB_AUTH_URL || "https://www.facebook.com/v23.0";

/**
 * Two Meta apps, two credential pairs — because Meta's consumer
 * Facebook Login use case (the site's fan sign-in) cannot share an app
 * with any business use case. FACEBOOK_CLIENT_* stays the LOGIN app
 * (auth.ts); the business app — Pages, Messenger, Instagram, Threads,
 * Marketing — is META_BUSINESS_APP_*.
 *
 * NO fallback on either half, and symmetry is the point: the secret
 * side dropped its FACEBOOK_CLIENT_SECRET fallback when the apps
 * split, and an ID that still fell back would let a half-configured
 * env pair the LOGIN app's client_id with the BUSINESS app's secret —
 * an OAuth exchange that can only fail, behind a connectConfigured()
 * that reports true because both halves are merely non-empty.
 */
function businessAppId(): string {
  return process.env.META_BUSINESS_APP_ID || "";
}
/**
 * One resolver, deliberately. This used to be a second copy of the
 * same fallback chain, and the two copies key different halves of the
 * system: this one verifies INBOUND webhook signatures, the appsecret
 * copy signs OUTBOUND calls. Two literals that must agree forever and
 * have no compile-time link is a split-brain waiting to happen — edit
 * one and Meta's events start failing signature while publishing
 * still works, or vice versa.
 */
export function businessAppSecret(): string {
  return businessSecret();
}

export function connectRedirectUri(provider: ConnectProvider): string {
  return `${siteUrl()}/api/social/callback/${provider}`;
}

/** Which providers have app credentials present, for the UI. */
export function connectConfigured(): Record<ConnectProvider, boolean> {
  return {
    instagram: Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET),
    threads: Boolean(process.env.THREADS_APP_ID && process.env.THREADS_APP_SECRET),
    facebook_page: Boolean(businessAppId() && businessAppSecret()),
  };
}

/**
 * The URL the connect button sends the user to. `state` is a CSRF nonce
 * the callback checks against a cookie — standard OAuth hygiene, and
 * the difference between "an editor connected their account" and "a
 * hostile page connected an editor to an attacker's account".
 */
export function authorizeUrl(provider: ConnectProvider, state: string): string {
  const redirect = connectRedirectUri(provider);
  if (provider === "instagram") {
    const qs = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID ?? "",
      redirect_uri: redirect,
      response_type: "code",
      scope: "instagram_business_basic,instagram_business_content_publish",
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${qs}`;
  }
  if (provider === "threads") {
    const qs = new URLSearchParams({
      client_id: process.env.THREADS_APP_ID ?? "",
      redirect_uri: redirect,
      response_type: "code",
      scope: "threads_basic,threads_content_publish",
      state,
    });
    return `${THREADS_AUTH}/oauth/authorize?${qs}`;
  }
  // Business apps authenticate via Facebook Login for Business, whose
  // dialog prefers a saved "configuration" (config_id) over raw
  // scopes. When Meta's dashboard hands you one, set META_FLB_CONFIG_ID
  // and it's used; without it, the classic scope list still asks for
  // exactly what page publishing needs.
  const configId = process.env.META_FLB_CONFIG_ID;
  const qs = new URLSearchParams({
    client_id: businessAppId(),
    redirect_uri: redirect,
    response_type: "code",
    ...(configId
      ? { config_id: configId }
      : { scope: "pages_show_list,pages_manage_posts,pages_read_engagement" }),
    state,
  });
  return `${FB_AUTH}/dialog/oauth?${qs}`;
}

async function postForm(url: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string } | string;
    error_message?: string;
    [k: string]: unknown;
  };
  if (!res.ok) {
    const msg =
      (typeof json.error === "object" ? json.error?.message : json.error) ||
      json.error_message ||
      `OAuth exchange ${res.status}`;
    throw new Error(String(msg));
  }
  return json;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    [k: string]: unknown;
  };
  if (!res.ok || json.error) throw new Error(json.error?.message || `OAuth ${res.status}`);
  return json;
}

export type ConnectedAccount = {
  provider: ConnectProvider;
  accountId: string;
  handle: string | null;
  name: string | null;
  accessToken: string;
  tokenExpiresAt: Date | null;
  scopes: string;
};

/**
 * Turn the ?code= Meta sent back into stored, long-lived channel(s).
 * Facebook can return several Pages from one grant; IG and Threads are
 * always exactly one account.
 */
export async function exchangeCode(
  provider: ConnectProvider,
  code: string
): Promise<ConnectedAccount[]> {
  const redirect = connectRedirectUri(provider);

  if (provider === "instagram") {
    const short = await postForm(`${IG_BASIC}/oauth/access_token`, {
      client_id: process.env.INSTAGRAM_APP_ID ?? "",
      client_secret: process.env.INSTAGRAM_APP_SECRET ?? "",
      grant_type: "authorization_code",
      redirect_uri: redirect,
      code,
    });
    // The long-lived exchange lives at the host root — no version path.
    const long = await getJson(
      `${IG_API.replace(/\/v[\d.]+$/, "")}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(
        process.env.INSTAGRAM_APP_SECRET ?? ""
      )}&access_token=${encodeURIComponent(String(short.access_token))}`
    );
    const token = String(long.access_token);
    const me = await getJson(
      `${IG_API}/me?fields=user_id,username,name&${new URLSearchParams({
        access_token: token,
        ...proofParams(token, process.env.INSTAGRAM_APP_SECRET),
      })}`
    );
    return [
      {
        provider,
        accountId: String(me.user_id ?? short.user_id),
        handle: me.username ? `@${me.username}` : null,
        name: (me.name as string) ?? null,
        accessToken: token,
        tokenExpiresAt: expiry(long.expires_in),
        scopes: "instagram_business_basic,instagram_business_content_publish",
      },
    ];
  }

  if (provider === "threads") {
    const short = await postForm(`${THREADS_API.replace(/\/v[\d.]+$/, "")}/oauth/access_token`, {
      client_id: process.env.THREADS_APP_ID ?? "",
      client_secret: process.env.THREADS_APP_SECRET ?? "",
      grant_type: "authorization_code",
      redirect_uri: redirect,
      code,
    });
    const long = await getJson(
      `${THREADS_API.replace(/\/v[\d.]+$/, "")}/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(
        process.env.THREADS_APP_SECRET ?? ""
      )}&access_token=${encodeURIComponent(String(short.access_token))}`
    );
    const token = String(long.access_token);
    const me = await getJson(
      `${THREADS_API}/me?fields=id,username,name&${new URLSearchParams({
        access_token: token,
        ...proofParams(token, process.env.THREADS_APP_SECRET),
      })}`
    );
    return [
      {
        provider,
        accountId: String(me.id ?? short.user_id),
        handle: me.username ? `@${me.username}` : null,
        name: (me.name as string) ?? null,
        accessToken: token,
        tokenExpiresAt: expiry(long.expires_in),
        scopes: "threads_basic,threads_content_publish",
      },
    ];
  }

  // facebook_page: code -> user token -> long-lived user token -> the
  // Pages they admin, each with its own never-expiring Page token.
  const userTok = await getJson(
    `${FB_API}/oauth/access_token?client_id=${encodeURIComponent(
      businessAppId()
    )}&client_secret=${encodeURIComponent(
      businessAppSecret()
    )}&redirect_uri=${encodeURIComponent(redirect)}&code=${encodeURIComponent(code)}`
  );
  const longUser = await getJson(
    `${FB_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
      businessAppId()
    )}&client_secret=${encodeURIComponent(
      businessAppSecret()
    )}&fb_exchange_token=${encodeURIComponent(String(userTok.access_token))}`
  );
  const pages = await getJson(
    `${FB_API}/me/accounts?fields=id,name,access_token&${new URLSearchParams({
      access_token: String(longUser.access_token),
      ...proofParams(String(longUser.access_token), businessAppSecret()),
    })}`
  );
  const list = Array.isArray(pages.data) ? (pages.data as Record<string, unknown>[]) : [];
  return list
    .filter((p) => p.id && p.access_token)
    .map((p) => ({
      provider: "facebook_page" as const,
      accountId: String(p.id),
      handle: null,
      name: (p.name as string) ?? null,
      // Page tokens minted from a long-lived user token don't expire.
      accessToken: String(p.access_token),
      tokenExpiresAt: null,
      scopes: "pages_show_list,pages_manage_posts,pages_read_engagement",
    }));
}

function expiry(expiresIn: unknown): Date | null {
  const s = Number(expiresIn ?? 0);
  return s > 0 ? new Date(Date.now() + s * 1000) : null;
}

/** Upsert what came back from the handshake onto the signed-in user. */
export async function storeConnections(userId: string, accounts: ConnectedAccount[]): Promise<number> {
  for (const a of accounts) {
    await prisma.socialAccount.upsert({
      where: {
        userId_provider_accountId: { userId, provider: a.provider, accountId: a.accountId },
      },
      update: {
        accessToken: a.accessToken,
        tokenExpiresAt: a.tokenExpiresAt,
        handle: a.handle,
        name: a.name,
        scopes: a.scopes,
        status: "ACTIVE",
        lastError: null,
        lastRefreshedAt: new Date(),
      },
      create: {
        userId,
        provider: a.provider,
        accountId: a.accountId,
        handle: a.handle,
        name: a.name,
        accessToken: a.accessToken,
        tokenExpiresAt: a.tokenExpiresAt,
        scopes: a.scopes,
      },
    });
  }
  return accounts.length;
}
