import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import SubmitForm from "./SubmitForm";

export const metadata = {
  title: "Submit Your Customs — Designer Kicks",
};
export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const session = await auth();
  const artist = session?.user?.id
    ? await prisma.artistProfile.findUnique({ where: { userId: session.user.id } })
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="tag text-volt">Enter the arena</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Submit Your <span className="text-volt">Customs</span>
      </h1>
      <p className="mt-3 text-smoke">
        Painted, deconstructed, dyed, rebuilt — if you made it, we want to see
        it. Approved submissions get matched into vote battles, and every
        battle builds your artist record on the{" "}
        <Link href="/artists" className="text-volt underline">league table</Link>.
      </p>

      <ul className="mt-6 space-y-1 rounded-xl border border-edge bg-surface p-4 text-sm text-smoke">
        <li>📸 One clean photo, good light, the shoe is the star (JPG/PNG/WebP, max 6MB)</li>
        <li>🎨 Your own work only — no stock photos, no reposts</li>
        <li>⚔️ We review every submission before it enters a battle</li>
      </ul>

      {!session?.user ? (
        <div className="mt-8 rounded-xl border border-volt/50 bg-surface p-8 text-center glow-volt">
          <p className="display text-2xl text-white">Sign in to submit</p>
          <p className="mt-2 text-smoke">
            Your customs, battle record, and followers all live on your artist
            profile.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/signin" className="rounded-lg bg-volt px-6 py-3 tag font-bold text-ink">
              Sign In
            </Link>
            <Link href="/register" className="rounded-lg border border-edge px-6 py-3 tag text-white hover:border-volt">
              Create Account
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          {artist && (
            <p className="mb-4 rounded-lg border border-edge bg-surface px-4 py-3 text-sm text-smoke">
              Posting as{" "}
              <Link href={`/artists/${artist.slug}`} className="font-bold text-volt">
                {artist.displayName}
              </Link>{" "}
              — this shoe joins your league record.
            </p>
          )}
          <SubmitForm
            artistDefaults={
              artist
                ? { artistName: artist.displayName, socialHandle: artist.instagram ?? "", locked: true }
                : { artistName: session.user.name ?? "", socialHandle: "", locked: false }
            }
          />
        </div>
      )}
    </div>
  );
}
