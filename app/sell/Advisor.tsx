"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Advisor() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "…" }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't reach the advisor — try again." }]);
    } finally {
      setPending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }
  }

  return (
    <div className="rounded-2xl border border-volt/40 bg-surface p-5">
      <p className="tag text-volt">Ask the Selling Advisor</p>
      <p className="mt-1 text-sm text-smoke">
        Where should I sell? How do I price a custom? Ask away — it&apos;s built for sneaker artists.
      </p>

      {messages.length > 0 && (
        <div ref={scrollRef} className="mt-4 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-edge bg-panel p-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user" ? "bg-volt/15 text-white" : "bg-surface text-white"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {pending && <p className="tag text-smoke">Advisor is thinking…</p>}
        </div>
      )}

      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="e.g. I make custom AF1s — where do I start selling?"
          className="flex-1 rounded-lg border border-edge bg-panel px-3 py-2.5 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
        <button type="submit" disabled={pending || !input.trim()}
          className="rounded-lg bg-volt px-5 tag font-bold text-ink disabled:opacity-50">
          {pending ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
