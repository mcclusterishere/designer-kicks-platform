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
