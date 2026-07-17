import SubmitForm from "./SubmitForm";

export const metadata = {
  title: "Submit Your Customs — Designer Kicks",
};

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="tag text-volt">Enter the arena</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        Submit Your <span className="text-volt">Customs</span>
      </h1>
      <p className="mt-3 text-smoke">
        Painted, deconstructed, dyed, rebuilt — if you made it, we want to see
        it. Approved submissions get matched into vote battles. Win and you&apos;re
        on the Heat List.
      </p>

      <ul className="mt-6 space-y-1 rounded-xl border border-edge bg-surface p-4 text-sm text-smoke">
        <li>📸 One clean photo, good light, the shoe is the star (JPG/PNG/WebP, max 6MB)</li>
        <li>🎨 Your own work only — no stock photos, no reposts</li>
        <li>⚔️ We review every submission before it enters a battle</li>
      </ul>

      <div className="mt-8">
        <SubmitForm />
      </div>
    </div>
  );
}
