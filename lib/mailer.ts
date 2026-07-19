/**
 * Minimal mail delivery for password resets.
 *
 * - With RESEND_API_KEY set, sends real email via the Resend API.
 * - Without it, logs the message to the server console and reports
 *   `delivered: false` so callers can surface the link in dev.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ delivered: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "The Heat Chart <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(`[mailer] (no RESEND_API_KEY — email not sent)\nTo: ${opts.to}\nSubject: ${opts.subject}\n\n${opts.text}`);
    return { delivered: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, text: opts.text }),
      // Never let a slow/hung Resend hold the request's DB connection open.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("[mailer] send failed:", res.status, await res.text());
      return { delivered: false };
    }
    return { delivered: true };
  } catch (e) {
    console.error("[mailer] send error:", e);
    return { delivered: false };
  }
}
