import { prisma } from "@/lib/db";
import { chatbotSettings } from "@/lib/chatbot";
import { geminiConfigured } from "@/lib/gemini";
import { engageConfigured } from "@/lib/metaEngage";
import { BotToggles, FlowButtons, FlowForm, InstallForm, PersonaForm } from "./ChatbotForms";

const TRIGGER_LABEL: Record<string, string> = {
  comment: "on comment",
  message: "on keyword DM",
  icebreaker: "front-door question",
  welcome: "first contact",
  default: "catch-all",
};

/**
 * The Chat bot room: the same machine ManyChat rents out, running on
 * our own webhook against our own database.
 *
 * The growth loop it powers, spelled out where the operator works:
 * post "comment HEAT and I'll send it to you" → every commenter gets
 * one private reply built to earn an answer → the answer opens the
 * conversation → the flow graph (and the AI net under it) takes over →
 * every person who ever replies becomes a contact we can talk to again
 * whenever THEY come back.
 */
export default async function ChatbotPanel() {
  const [settings, flows, contacts, recent] = await Promise.all([
    chatbotSettings(),
    prisma.chatFlow.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.chatContact.count(),
    prisma.chatContact.findMany({
      orderBy: { lastInboundAt: "desc" },
      take: 6,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 2 } },
    }),
  ]);

  return (
    <section className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl text-white">Chat bot</h2>
        <p className="tag text-smoke">
          {contacts} contact{contacts === 1 ? "" : "s"} ·{" "}
          {flows.filter((f) => f.active).length} live flow{flows.filter((f) => f.active).length === 1 ? "" : "s"}
        </p>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-smoke">
        Post &quot;comment <span className="text-white">HEAT</span> and I&apos;ll send it to
        you&quot;. Every commenter gets one private reply — written to earn an answer, because
        the answer is what opens the conversation. From there the flows run it, and the AI
        catches what they don&apos;t. It only ever answers people;{" "}
        <span className="text-white">nothing here can message a stranger first</span> — that&apos;s
        Meta&apos;s hard rule, and the reason comment bait is the whole game.
      </p>

      {!engageConfigured() && (
        <p className="mt-3 rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-smoke">
          Needs the Page token (FB_PAGE_ID + FB_PAGE_ACCESS_TOKEN) and the webhook — see
          META-SETUP.md.
        </p>
      )}

      <div className="mt-4">
        <BotToggles enabled={settings.enabled} aiOn={settings.aiFallback} />
        {settings.aiFallback && !geminiConfigured() && (
          <p className="mt-1.5 text-xs text-heat">
            AI fallback is on but GEMINI_API_KEY isn&apos;t set — unmatched messages will wait
            for a human until it is.
          </p>
        )}
      </div>

      {/* ---- Flows ------------------------------------------------- */}
      <div className="mt-6">
        <p className="tag text-volt">Flows — the conversation, node by node</p>
        {flows.length > 0 && (
          <div className="mt-2 space-y-2">
            {flows.map((f) => {
              const buttons = Array.isArray(f.quickReplies)
                ? (f.quickReplies as Array<{ label?: string }>).map((q) => q.label).filter(Boolean)
                : [];
              return (
                <div
                  key={f.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-edge bg-panel p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${f.active ? "text-white" : "text-smoke line-through"}`}>
                      {f.name}
                      <span className="ml-2 tag text-volt">{TRIGGER_LABEL[f.trigger] ?? f.trigger}</span>
                      {f.keywords.length > 0 && (
                        <span className="ml-2 tag text-smoke">{f.keywords.join(", ")}</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-smoke">{f.message}</span>
                    <span className="block text-xs text-smoke">
                      fired {f.fired}×{buttons.length > 0 && ` · buttons: ${buttons.join(" · ")}`}
                    </span>
                  </span>
                  <FlowButtons flowId={f.id} active={f.active} />
                </div>
              );
            })}
          </div>
        )}
        <FlowForm flows={flows.map((f) => ({ id: f.id, name: f.name }))} />
      </div>

      {/* ---- Front door -------------------------------------------- */}
      <div className="mt-6">
        <p className="tag text-volt">The front door</p>
        <p className="mt-1 text-xs text-smoke">
          Greeting + Get Started + up to four tap-to-ask questions a brand-new visitor sees
          before typing. The questions are your &quot;front-door question&quot; flows, in order.
        </p>
        <InstallForm hasOpeners={flows.some((f) => f.trigger === "icebreaker" && f.active)} />
      </div>

      {/* ---- Voice ------------------------------------------------- */}
      <div className="mt-6">
        <p className="tag text-volt">The AI&apos;s voice</p>
        <p className="mt-1 text-xs text-smoke">
          What Gemini is told before answering anything a flow didn&apos;t catch. It introduces
          itself as a bot and hands anyone who asks to a human — keep both in whatever you
          write here.
        </p>
        <PersonaForm persona={settings.persona} />
      </div>

      {/* ---- Recent conversations ---------------------------------- */}
      {recent.length > 0 && (
        <div className="mt-6">
          <p className="tag text-volt">Latest conversations</p>
          <div className="mt-2 space-y-2">
            {recent.map((c) => (
              <div key={c.id} className="rounded-lg border border-edge bg-panel p-3">
                <p className="text-sm text-white">
                  {c.name ?? "Someone"} <span className="tag text-smoke">{c.platform}</span>
                </p>
                {c.messages
                  .slice()
                  .reverse()
                  .map((m) => (
                    <p key={m.id} className="mt-0.5 break-words text-xs text-smoke">
                      <span className={m.direction === "in" ? "text-white" : "text-volt"}>
                        {m.direction === "in" ? "them" : m.flowId === "ai" ? "bot (AI)" : "bot"}:
                      </span>{" "}
                      {m.text}
                    </p>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
