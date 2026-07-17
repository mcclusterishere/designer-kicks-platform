import { cookies } from "next/headers";
import { createHash } from "crypto";

const ADMIN_COOKIE = "dk_admin";

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "heatcheck";
}

function adminToken(): string {
  return createHash("sha256")
    .update(`dk-admin:${adminPassword()}`)
    .digest("hex");
}

export function checkPassword(password: string): boolean {
  return password === adminPassword();
}

export async function setAdminSession() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === adminToken();
}
