import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import RegisterForm from "./RegisterForm";

export const metadata = { title: "Create Account — Designer Kicks" };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/profile");

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <p className="tag text-volt">Join the culture</p>
      <h1 className="display mt-2 text-4xl text-white">Create Account</h1>
      <p className="mt-2 text-sm text-smoke">
        A fan account is instant — vote in battles, play the Heat Check,
        win giveaways, and build your collector closet. Artists apply for
        an upgraded account after joining (approval required).
      </p>
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
