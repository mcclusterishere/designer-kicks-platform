"use client";

import Link from "next/link";
import { useActionState } from "react";
import { scanDropRadar, publishArticle, deleteArticle, type DropRadarScan } from "@/app/actions";

type Draft = {
  id: string;
  title: string;
  coverImage: string | null;
  sku: string | null;
  dropLabel: string | null;
  excerpt: string;
};

/**
 * Drop Radar review queue — auto-drafted retail drop posts. "Scan" pulls
 * a fresh batch from live catalog releases (Gemini writes the prose,
 * facts come from the DB). Each draft is one tap to publish, edit, or bin.
 */
export default function DropRadar({ drafts }: { drafts: Draft[] }) {
  const [state, scan, scanning] = useActionState<DropRadarScan | null, FormData>(
    async () => scanDropRadar(),
    null
  );

  return (
    <div className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="tag text-volt">Drop Radar</p>
          <p className="mt-1 text-sm text-smoke">
            Auto-drafts full drop posts from real releases in the catalog — facts pulled
            from the database, story written for you. Review and publish in one tap.
          </p>
        </div>
        <form action={scan}>
          <button
            type="submit"
            disabled={scanning}
            className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Scan for new drops"}
          </button>
        </form>
      </div>

      {state && !state.ok && (
        <p className="mt-3 rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">{state.error}</p>
      )}
      {state?.ok && (
        <p className="mt-3 rounded border border-volt/40 bg-volt/10 px-3 py-2 text-sm text-volt">
          Scanned {state.scanned} release{state.scanned === 1 ? "" : "s"} · drafted {state.drafted} new post
          {state.drafted === 1 ? "" : "s"} · skipped {state.skipped} already covered.
        </p>
      )}

      <div className="mt-4 space-y-2">
        {drafts.length === 0 ? (
          <p className="text-sm text-smoke">
            No drafts waiting. Hit “Scan for new drops” — it turns upcoming releases in the catalog
            into ready-to-publish posts. (Run the catalog refresh first if the board is thin.)
          </p>
        ) : (
          drafts.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-edge bg-panel p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.coverImage || "/seed/news-1.svg"}
                alt={d.title}
                className="h-14 w-14 shrink-0 rounded bg-surface object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">
                  {d.title}
                  <span className="tag ml-2 text-smoke">draft</span>
                </p>
                <p className="truncate text-xs text-smoke">
                  {d.dropLabel ? `Drops ${d.dropLabel}` : "Date TBA"}
                  {d.sku ? ` · ${d.sku}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href={`/admin?editArticle=${d.id}#newsroom`}
                  className="rounded border border-edge px-2.5 py-1.5 tag text-white"
                >
                  Edit
                </Link>
                <form action={publishArticle.bind(null, d.id)}>
                  <button className="rounded border border-volt px-2.5 py-1.5 tag font-bold text-volt">
                    Publish
                  </button>
                </form>
                <form
                  action={deleteArticle.bind(null, d.id)}
                  onSubmit={(e) => {
                    if (!confirm(`Discard the draft “${d.title}”?`)) e.preventDefault();
                  }}
                >
                  <button className="rounded border border-heat px-2.5 py-1.5 tag text-heat">Discard</button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
