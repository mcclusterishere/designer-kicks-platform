import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import SubmitForm from "./SubmitForm";
import ApplyForm from "./ApplyForm";

export const metadata = {
  title: "Submit Your Customs — The Heat Chart",
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
      {/* "Customs" stays — this page is read by people who make them and
          that IS the word they use. What doesn't stay is assuming they
          already know how the site works: "matched into vote battles" and
          "league table" describe a mechanic they haven't seen yet. */}
      <p className="mt-3 text-smoke">
        Painted, deconstructed, dyed, rebuilt — if you made it, we want to see it.
      </p>
      <p className="mt-2 text-smoke">
        Once we approve it, your piece goes head to head against another artist&apos;s
        and people vote for the one they&apos;d rather own. Wins and losses build up your
        record on the{" "}
        <Link href="/artists" className="text-volt underline">
          artist rankings
        </Link>
        .
      </p>

      <ul className="mt-6 space-y-1 rounded-xl border border-edge bg-surface p-4 text-sm text-smoke">
        <li>📸 One clean photo, good light, your work is the star (JPG/PNG/WebP, max 6MB)</li>
        <li>Your own work only — no stock photos, no reposts</li>
        <li>We review every submission before it enters a battle</li>
        {/* Said up front because it was being discovered the hard way:
            after filling the form and pushing a 40MB clip. Also kills a
            misconception worth killing — artists were reading the video
            cap as a cap on pieces. Post as many pieces as you like. */}
        <li>
          Post as many pieces as you want. The only cap is{" "}
          <span className="text-white">one video a day</span> while we scale
          hosting — photos are unlimited.
        </li>
      </ul>

      {!session?.user ? (
        <div className="mt-8 rounded-xl border border-volt/50 bg-surface p-8 text-center glow-volt">
          <p className="display text-2xl text-white">Sign in to submit</p>
          <p className="mt-2 text-smoke">
            Your customs, battle record, and followers all live on your artist
            profile.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/signin" className="rounded-lg btn-hard px-6 py-3 tag font-bold">
              Sign In
            </Link>
            <Link href="/register" className="rounded-lg border border-edge px-6 py-3 tag text-white hover:border-volt">
              Create Account
            </Link>
          </div>
        </div>
      ) : !artist ? (
        <div className="mt-8">
          <div className="mb-5 rounded-xl border border-edge bg-surface p-4 text-sm text-smoke">
            <p>
              <span className="font-bold text-white">You have a fan account</span>{" "}
              — vote, play the Heat Check, win giveaways, and build your
              collector closet. To compete with your own customs, apply for
              an <span className="text-volt">artist account</span> below.
            </p>
          </div>
          <ApplyForm />
        </div>
      ) : artist.status === "PENDING" ? (
        <div className="mt-8 rounded-xl border border-heat/50 bg-surface p-8 text-center">
          <p className="display text-2xl text-heat">Application Under Review</p>
          <p className="mt-3 text-smoke">
            We&apos;re looking at <span className="text-white">{artist.displayName}</span>
            &apos;s application. You&apos;ll be able to submit customs the moment
            you&apos;re approved — keep voting and playing in the meantime.
          </p>
        </div>
      ) : artist.status === "REJECTED" ? (
        <div className="mt-8">
          <div className="mb-5 rounded-xl border border-heat/50 bg-surface p-4 text-sm text-smoke">
            Your last application wasn&apos;t approved. Update your info and
            portfolio and apply again.
          </div>
          <ApplyForm
            defaults={{
              displayName: artist.displayName,
              instagram: artist.instagram,
              city: artist.city,
              portfolioUrl: artist.portfolioUrl,
              bio: artist.bio,
            }}
          />
        </div>
      ) : (
        <div className="mt-8">
          <p className="mb-4 rounded-lg border border-edge bg-surface px-4 py-3 text-sm text-smoke">
            Posting as{" "}
            <Link href={`/artists/${artist.slug}`} className="font-bold text-volt">
              {artist.displayName}
            </Link>{" "}
            <span className="tag text-volt">✓ approved artist</span> — this
            piece joins your league record.
          </p>
          <SubmitForm
            artistDefaults={{
              artistName: artist.displayName,
              socialHandle: artist.instagram ?? "",
              locked: true,
            }}
          />
        </div>
      )}
    </div>
  );
}
