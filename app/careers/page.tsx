import Link from "next/link";
import ReactMarkdown from "react-markdown";
import LocalPay from "@/components/LocalPay";
import remarkGfm from "remark-gfm";
import { prisma } from "@/lib/db";
import ApplyForm from "./ApplyForm";

export const metadata = {
  title: "Careers — Work With The Heat Chart",
  description:
    "Join The Heat Chart. Open roles for editors and community builders in custom-sneaker culture — remote, paid per contribution.",
};
export const dynamic = "force-dynamic";

export default async function CareersPage() {
  const jobs = await prisma.jobPosting.findMany({
    where: { status: "OPEN" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="tag text-volt">Careers</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">Build the culture with us</h1>
      <p className="mt-3 text-smoke">
        The Heat Chart is a home for custom-sneaker artists and the people who
        love their work. We hire people who live in the culture. Paid,
        remote-first, and real.
      </p>

      {jobs.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-edge bg-surface p-6 text-center">
          <p className="text-white">No open roles right now.</p>
          <p className="mt-1 text-sm text-smoke">
            Check back — or introduce yourself on{" "}
            <Link href="/feed" className="text-volt underline">the Feed</Link>.
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-8">
          {jobs.map((job) => (
            <article key={job.id} className="rounded-2xl border border-edge bg-surface p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="display text-2xl text-white">{job.title}</h2>
                <span className="tag rounded-full border border-volt/50 px-3 py-1 text-volt">{job.location}</span>
              </div>
              <p className="mt-1 tag text-heat">{job.payLine}</p>
              {/* International recruiting: the first $ figure in the pay
                  line converts to the visitor's own currency. */}
              {(() => {
                const m = job.payLine.match(/\$([0-9]+(?:\.[0-9]+)?)/);
                return m ? <LocalPay usd={parseFloat(m[1])} className="mt-1" /> : null;
              })()}
              <div className="prose-invert mt-4 max-w-none space-y-3 text-sm leading-relaxed text-smoke [&_a]:text-volt [&_a]:underline [&_h2]:mt-4 [&_h2]:text-white [&_h3]:text-white [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{job.body}</ReactMarkdown>
              </div>
              <div className="mt-6 border-t border-edge pt-5">
                <p className="tag text-smoke">Apply</p>
                <div className="mt-3">
                  <ApplyForm jobId={job.id} jobTitle={job.title} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
