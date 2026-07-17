"use client";

import { useState, useTransition } from "react";
import { toggleFollowArtist } from "@/app/actions";

type Props = {
  artistId: string;
  initialFollowing: boolean;
  isAuthed: boolean;
};

export default function FollowButton({ artistId, initialFollowing, isAuthed }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  if (!isAuthed) {
    return (
      <a
        href="/signin"
        className="rounded-lg border border-volt px-5 py-2.5 tag font-bold text-volt transition hover:bg-volt hover:text-ink"
      >
        Sign In To Follow
      </a>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await toggleFollowArtist(artistId);
          if (res.ok) setFollowing((f) => !f);
        })
      }
      className={`rounded-lg px-5 py-2.5 tag font-bold transition disabled:opacity-50 ${
        following
          ? "border border-edge text-smoke hover:border-heat hover:text-heat"
          : "bg-volt text-ink hover:opacity-90"
      }`}
    >
      {pending ? "…" : following ? "Following ✓" : "+ Follow"}
    </button>
  );
}
