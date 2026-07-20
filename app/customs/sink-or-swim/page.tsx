import Link from "next/link";
import ScrollStory, { type StoryFrame } from "@/components/ScrollStory";
import DonorShoe from "@/components/DonorShoe";

/**
 * Campaign page: the scroll-driven photo storyline trial. The photo
 * answer to scroll-scrubbed video — every viewport of scroll advances
 * one frame of the shoot. Swap or extend FRAMES as new campaign photos
 * land in /public/seed/campaign (night-shoot frames slot in ahead of
 * the studio angles; nothing else changes).
 */
export const metadata = {
  title: "Sink or Swim — the AF1 Custom, Shot at Night | The Heat Chart",
  description:
    "Trap tape on one side, open water on the other. Scroll the story of the Sink or Swim Air Force 1 custom — every angle, the prop cup, the whole mood.",
};

const FRAMES: StoryFrame[] = [
  {
    src: "/seed/campaign/af1-pair-profile.jpeg",
    title: "Sink or Swim.",
    caption:
      "One pair, two stories. Crime-scene tape and the chalk outline on one shoe — open water and sharks on the other. Hand-painted on Air Force 1s.",
  },
  {
    src: "/seed/campaign/af1-sink-or-swim.jpeg",
    title: "Trap or Die? Sink or Swim?",
    caption:
      "The questions are lettered right on the sole wall. Red handprints like a warning you walked past anyway.",
  },
  {
    src: "/seed/campaign/af1-top-cup.jpeg",
    title: "The prop cup.",
    caption: "Purple to match. If you know, you know — and the X marks both toes.",
  },
  {
    src: "/seed/campaign/af1-heels.jpeg",
    title: "Evidence of the maker.",
    caption:
      "SIKE AIR on the heel tabs, painted fingerprints pressed into the leather. Every pair is a one-of-one — this is the proof.",
  },
];

export default function SinkOrSwimPage() {
  return (
    <div className="bg-ink">
      {/* Cold open — straight into the story */}
      <div className="mx-auto max-w-2xl px-4 pb-4 pt-10 text-center">
        <p className="tag text-heat">The Heat Chart · Custom Story</p>
        <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
          Sink <span className="text-gradient-volt">or</span> Swim
        </h1>
        <p className="mt-2 text-sm text-smoke">
          A hand-painted Air Force 1 one-of-one. Scroll — the shoot plays as you go.
        </p>
      </div>

      <ScrollStory frames={FRAMES} />

      {/* The landing: what you do about it */}
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rule mx-auto w-16" />
        <h2 className="display mt-4 text-3xl text-white">Want Heat Like This?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-smoke">
          Customs like this pair battle on the chart every week — the culture
          votes, the winners climb. Start with the base pair, or go watch the
          artists fight it out.
        </p>
        <div className="mx-auto mt-6 grid max-w-sm gap-2">
          <Link href="/battles" className="btn-hard block rounded-xl py-3 tag font-bold">
            Vote In Live Battles
          </Link>
          <Link href="/submit" className="btn-hard-volt block rounded-xl py-3 tag font-bold">
            Submit Your Own Custom
          </Link>
        </div>
        <div className="mx-auto mt-8 max-w-sm text-left">
          <DonorShoe
            brand="Nike"
            silhouette="Air Force 1"
            baseShoe="Air Force 1 Low"
            refTag="campaign:sink-or-swim"
          />
        </div>
      </div>
    </div>
  );
}
