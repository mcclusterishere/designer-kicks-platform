// Shared plumbing for the browser test suites.
//
// Prerequisites: a running server (npm run build && npm start) against a
// seeded database (npm run db:deploy && npm run db:seed).
//
// Env knobs:
//   E2E_BASE_URL      target server (default http://localhost:3000)
//   CHROMIUM_PATH     explicit Chromium binary (default: Playwright's)
//   SERVER_LOG        server stdout log file — enables the password-reset
//                     mail-fallback check in the account suite
//   ADMIN_PASSWORD    admin password (default "heatcheck", the dev default)
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "heatcheck";

export const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), ".artifacts");
mkdirSync(SHOTS, { recursive: true });

// Minimal valid 1x1 PNG for upload tests.
export const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

export function makeChecker(results) {
  return function check(name, ok, extra = "") {
    results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
    if (!ok) process.exitCode = 1;
  };
}

export async function launchBrowser() {
  return chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  );
}

/**
 * Fill and submit the signup form the way a real person does.
 *
 * Two gates sit between "typed my details" and "have an account", and
 * both were added after these suites were written, which is why every
 * registering suite silently timed out waiting for a redirect that was
 * never coming:
 *
 *   1. The PMA membership agreement. It is a `required` checkbox, so the
 *      BROWSER refuses to submit and the server never sees the attempt —
 *      no request, no error, no clue. Nothing on the page changes.
 *   2. The unknown-domain guard. Every address these suites use lives on
 *      @test.example, deliberately, because a real domain would send real
 *      mail to a real inbox. Signup doesn't recognise it and puts up a
 *      two-step "is that really your email?" dialog, which is exactly
 *      what it should do for a human and exactly what stalls a script.
 *
 * Both are correct product behaviour. Encoding them once here means the
 * next thing added to signup breaks one helper instead of five suites.
 */
export async function registerAccount(page, { name, email, password }) {
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", password);
  // Signup asks for it twice. The browser blocks submit on a mismatch, so
  // a script that fills one box gets a form that never posts.
  if (await page.locator("#confirmPassword").count()) {
    await page.fill("#confirmPassword", password);
  }
  await page.check("#age13");
  await page.check("#pma");
  await page.getByRole("button", { name: "Create Account" }).click();
  await passDomainGuard(page);
}

/**
 * Click through the "is that really your email?" dialog if it appeared.
 *
 * Deliberately silent when there is no dialog — a suite using a domain
 * signup does recognise should not have to care. The confirm is two taps
 * on purpose: the first arms it, so nobody blows past the warning with
 * one reflexive click on the address they'll need to reset their password.
 */
export async function passDomainGuard(page) {
  const arm = page.getByRole("button", { name: /this is my own domain/i });
  const appeared = await arm
    .waitFor({ state: "visible", timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return false;
  await arm.click();
  await page.getByRole("button", { name: /Confirm: sign me up/i }).click();
  return true;
}
