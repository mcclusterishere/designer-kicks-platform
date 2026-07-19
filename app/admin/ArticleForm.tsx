"use client";

import { useActionState } from "react";
import { saveArticle, type ActionResult } from "@/app/actions";

type Defaults = {
  id?: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  coverImage?: string | null;
  tags?: string | null;
  status?: string;
  dropAt?: Date | null;
  raffleUrl?: string | null;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export default function ArticleForm({ defaults }: { defaults?: Defaults }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveArticle,
    null
  );
  const editing = Boolean(defaults?.id);

  return (
    <form action={formAction} className="space-y-4" key={defaults?.id ?? "new"}>
      {editing && <input type="hidden" name="id" value={defaults!.id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="a-title">Headline *</label>
          <input id="a-title" name="title" required maxLength={120} defaultValue={defaults?.title}
            placeholder='e.g. "Jordan 4 Bred Reimagined: Release Date, Price & How To Cop"' className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="a-slug">URL slug (blank = auto from headline)</label>
          <input id="a-slug" name="slug" maxLength={80} defaultValue={defaults?.slug}
            placeholder="jordan-4-bred-reimagined-release-date" className={inputClass} />
        </div>
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="a-excerpt">
          Excerpt * <span className="normal-case">(doubles as the Google meta description — front-load keywords, ≤160 chars ideal)</span>
        </label>
        <input id="a-excerpt" name="excerpt" required maxLength={200} defaultValue={defaults?.excerpt}
          placeholder="The Air Jordan 4 'Bred Reimagined' drops [date] for $215. Here's the release info, style code, and where to enter raffles." className={inputClass} />
      </div>
      <div>
        <label className="tag text-smoke" htmlFor="a-content">
          Body * <span className="normal-case">(Markdown: ## headings, **bold**, lists, tables, links)</span>
        </label>
        <textarea id="a-content" name="content" required rows={14} defaultValue={defaults?.content}
          placeholder={"## When does it drop?\n\nThe release hits SNKRS on..."}
          className={`${inputClass} font-mono text-sm`} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="a-cover">Cover image URL</label>
          <input id="a-cover" name="coverImage" defaultValue={defaults?.coverImage ?? ""}
            placeholder="/seed/news-1.svg or https://…" className={inputClass} />
          <label className="tag mt-2 block text-smoke" htmlFor="a-cover-file">
            …or upload a photo <span className="normal-case">(beats the URL — e.g. the official press shot)</span>
          </label>
          <input id="a-cover-file" name="cover" type="file" accept="image/jpeg,image/png,image/webp"
            className="mt-1 w-full rounded-lg border border-dashed border-edge bg-surface px-3 py-2 text-xs text-smoke file:mr-2 file:rounded file:border-0 file:bg-volt file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-ink" />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="a-tags">Tags (comma-separated)</label>
          <input id="a-tags" name="tags" defaultValue={defaults?.tags ?? ""}
            placeholder="Jordan, Release Dates, SNKRS" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="a-drop">
            Drop date <span className="normal-case">(fills the free Drop Calendar)</span>
          </label>
          <input id="a-drop" name="dropAt" type="date"
            defaultValue={defaults?.dropAt ? new Date(defaults.dropAt).toISOString().slice(0, 10) : ""}
            className={inputClass} />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="a-raffle">Raffle / where-to-cop link</label>
          <input id="a-raffle" name="raffleUrl" defaultValue={defaults?.raffleUrl ?? ""}
            placeholder="https://www.nike.com/launch" className={inputClass} />
        </div>
      </div>
      {/* The culture question that rides with this story into the feed */}
      <div className="rounded-lg border border-volt/30 bg-surface p-3">
        <p className="tag text-volt">Culture question (optional — floats in The Feed, feeds Culture IQ)</p>
        <input name="cqQuestion" maxLength={200} placeholder='e.g. "What year did the AJ1 first release?"'
          className={inputClass} />
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <input key={i} name={`cqOption${i}`} maxLength={80}
              placeholder={`Option ${["A", "B", "C", "D"][i]}`} className={inputClass} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select name="cqAnswer" defaultValue="0" className={inputClass} aria-label="Correct option">
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>Correct: {["A", "B", "C", "D"][i]}</option>
            ))}
          </select>
          <input name="cqExplanation" maxLength={200} placeholder="One-line explanation (shown after answering)"
            className={inputClass} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-smoke">
        <input type="checkbox" name="publish" defaultChecked={defaults?.status === "PUBLISHED"}
          className="h-4 w-4 accent-[#d9b96a]" />
        Published (unchecked = draft, hidden from the site)
      </label>
      {state?.error && <p className="text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="text-sm text-volt">Saved.</p>}
      <button type="submit" disabled={pending}
        className="rounded-lg bg-volt px-5 py-2.5 tag font-bold text-ink disabled:opacity-50">
        {pending ? "Saving…" : editing ? "Update Article" : "Save Article"}
      </button>
    </form>
  );
}
