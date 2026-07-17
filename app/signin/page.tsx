import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn, oauthProviders } from "@/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign In — Designer Kicks" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/profile");

  const hasOAuth = oauthProviders.google || oauthProviders.facebook;

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="tag text-volt">Welcome back</p>
      <h1 className="display mt-2 text-4xl text-white">Sign In</h1>
      <p className="mt-2 text-sm text-smoke">
        Vote in battles, play the trivia gauntlet, and win giveaways.
      </p>

      {hasOAuth && (
        <div className="mt-6 space-y-3">
          {oauthProviders.google && (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/profile" });
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
                await signIn("facebook", { redirectTo: "/profile" });
              }}
            >
              <button className="w-full rounded-lg border border-edge bg-surface py-3 tag text-white transition hover:border-volt">
                Continue with Facebook
              </button>
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
        <LoginForm />
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
