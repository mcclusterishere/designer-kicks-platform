import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth, signIn, oauthProviders } from "@/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign In — The Heat Chart" };

/**
 * Only same-origin paths are honoured as a return target.
 *
 * `?next=` is attacker-supplied. Without this check it is an open
 * redirect: a link to our own sign-in page that lands the user on
 * somebody else's site, wearing our domain in the address bar right up
 * until the moment they type their password.
 */
function safeNext(raw: string | undefined): string {
  if (!raw) return "/profile";
  // Must be a single-slash absolute path. "//evil.com" and
  // "https://evil.com" are both rejected.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/profile";
  return raw;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  const session = await auth();
  if (session?.user) redirect(next);

  // Inside the iOS shell (App Store 4.8): email sign-in only — no
  // third-party login buttons.
  const inApp = ((await headers()).get("user-agent") ?? "").includes("HeatChartApp");
  const hasOAuth = !inApp && (oauthProviders.google || oauthProviders.facebook);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="tag text-volt">Welcome back</p>
      <h1 className="display mt-2 text-4xl text-white">Sign In</h1>
      <p className="mt-2 text-sm text-smoke">
        Vote in battles, take the Heat Check, and win giveaways.
      </p>

      {hasOAuth && (
        <div className="mt-6 space-y-3">
          {oauthProviders.google && (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: next });
              }}
            >
              <button className="w-full rounded-lg border border-edge bg-surface py-3 tag text-white transition hover:border-volt">
                Continue with Google
              </button>
            </form>
          )}
          {oauthProviders.facebook && (
            <form
              action={async () => {
                "use server";
                await signIn("facebook", { redirectTo: next });
              }}
            >
              <button className="w-full rounded-lg border border-[#1877F2]/50 bg-surface py-3 tag text-white transition hover:border-[#1877F2]">
                Continue with Facebook
              </button>
              <p className="mt-1.5 text-center text-xs text-smoke/70">
                Coming from Instagram? Use the Facebook account linked to it —
                one tap, no new password.
              </p>
            </form>
          )}
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-edge" />
            <span className="tag text-smoke">or with email</span>
            <div className="h-px flex-1 bg-edge" />
          </div>
        </div>
      )}

      <div className="mt-4">
        <LoginForm next={next} />
      </div>

      <div className="mt-6 flex justify-between text-sm">
        <Link href="/register" className="text-volt underline">
          Create an account
        </Link>
        <Link href="/forgot-password" className="text-smoke underline hover:text-white">
          Forgot password?
        </Link>
      </div>
    </div>
  );
}
