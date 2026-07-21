import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn, oauthProviders } from "@/auth";
import RegisterForm from "./RegisterForm";

export const metadata = { title: "Create Account — The Heat Chart" };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/profile");

  const hasOAuth = oauthProviders.google || oauthProviders.facebook;

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="tag text-volt">Join the culture</p>
      <h1 className="display mt-2 text-4xl text-white">Create Account</h1>
      <p className="mt-2 text-sm text-smoke">
        A fan account is instant — vote in battles, play the Heat Check,
        win giveaways, and build your collector closet. Artists apply for
        an upgraded account after joining (approval required).
      </p>

      {hasOAuth && (
        <div className="mt-6 space-y-3">
          {oauthProviders.facebook && (
            <form
              action={async () => {
                "use server";
                await signIn("facebook", { redirectTo: "/profile" });
              }}
            >
              <button className="w-full rounded-lg border border-[#1877F2]/50 bg-surface py-3 tag text-white transition hover:border-[#1877F2]">
                Sign Up with Facebook
              </button>
              <p className="mt-1.5 text-center text-xs text-smoke/70">
                Coming from Instagram? Use the Facebook account linked to it —
                a real account in one tap, no new password.
              </p>
            </form>
          )}
          {oauthProviders.google && (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/profile" });
              }}
            >
              <button className="w-full rounded-lg border border-edge bg-surface py-3 tag text-white transition hover:border-volt">
                Sign Up with Google
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

      <div className="mt-6">
        <RegisterForm />
      </div>
      <p className="mt-6 text-sm text-smoke">
        Already have an account?{" "}
        <Link href="/signin" className="text-volt underline">Sign in</Link>
      </p>
    </div>
  );
}
