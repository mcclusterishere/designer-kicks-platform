import { NextRequest, NextResponse } from "next/server";
import {
  parseWebhookPayload,
  runAutomation,
  storeEvents,
  verifyWebhookSignature,
} from "@/lib/metaEngage";

/**
 * Meta's webhook endpoint — the ear. Comments, DMs and mentions on the
 * Page and the IG account arrive here in real time, get stored for the
 * admin Engagement desk, and run through the (reactive-only) rules.
 *
 * GET  = Meta's one-time subscription handshake: echo hub.challenge
 *        back iff hub.verify_token matches ours.
 * POST = events. Signature-checked against the app secret before a
 *        byte of it is trusted; 200 fast either way, because Meta
 *        disables endpoints that respond slowly or with errors.
 */

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const ours = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && ours && token === ours && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const ok = verifyWebhookSignature(
    raw,
    req.headers.get("x-hub-signature-256"),
    process.env.FACEBOOK_CLIENT_SECRET ?? ""
  );
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const events = parseWebhookPayload(payload);
  // Store first, automate after — a rules-engine crash must never cost
  // the desk its record of what came in.
  await storeEvents(events);
  runAutomation(events).catch((e) => console.error("[webhooks] automation:", e));

  return NextResponse.json({ received: events.length });
}
