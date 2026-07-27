"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "How should I price my customs?",
  "Write me a stronger bio",
  "What should I post to climb the chart?",
  "How do I win more battles?",
];

/**
 * The artist's private AI corner in the Studio — a Gemini chat that
 * already knows their record, rank, and pieces. Suggestion chips get a
 * blank-page artist talking; the thread scrolls like a messenger.
 */
export default function StudioAssistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  async function ask(text: string) {
    const t = text.trim();
    if (!t || pending) return;
    const next: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/studio-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "…" }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Couldn't reach your assistant — try again." },
      ]);
    } finally {
      setPending(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
      );
    }
  }

  return (
    <div className="rounded-2xl border border-volt/40 bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-volt/15 text-volt">✦</span>
        <div>
          <p className="tag text-volt">Studio Assistant</p>
          <p className="text-xs text-smoke">Private to you — it knows your record and your pieces.</p>
        </div>
      </div>

      {messages.length > 0 && (
        <div
          ref={scrollRef}
          className="mt-4 max-h-96 space-y-2 overflow-y-auto rounded-xl border border-edge bg-panel p-3"
        >
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-volt/15 text-white" : "bg-surface text-white"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {pending && <p className="tag text-smoke">Thinking about your work…</p>}
        </div>
      )}

      {messages.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-full border border-edge bg-panel px-3 py-1.5 text-xs text-smoke transition hover:border-volt hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="Ask your assistant anything…"
          className="flex-1 rounded-lg border border-edge bg-panel px-3 py-2.5 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-lg btn-hard px-5 tag font-bold disabled:opacity-50"
        >
          {pending ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
