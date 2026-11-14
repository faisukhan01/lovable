"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ClipboardCopy,
  Copy,
  Hammer,
  Loader2,
  Plus,
  SendHorizontal,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, assistantChat, createProject } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

const STORAGE_KEY = "lovify:chat-history";
const MAX_PERSISTED = 60;

const STARTERS = [
  "Brainstorm features for a fitness app",
  "Write landing copy for my startup",
  "Plan a CRM data model",
  "What can Lovify build?",
];

/* ------------------- build-intent detection ------------------- */
/* Lovify Chat is chat-only. When the user clearly asks for an app, surface a
   one-tap "Build this app" CTA so the conversation never dead-ends. */
const BUILD_VERB_RE =
  /\b(build|create|make|design|generate|develop|code|give me|i want|i need|i'd like|would like)\b/i;
const BUILD_NOUN_RE =
  /\b(app|application|website|web ?site|web ?app|web ?page|page|game|tool|dashboard|tracker|calculator|portfolio|landing|blog|store|shop|todo|to-do|crm|clone|platform|marketplace|quiz|timer|widget|form|portfolio site|pricing site)\b/i;

function looksLikeBuildRequest(text: string): boolean {
  return BUILD_VERB_RE.test(text) && BUILD_NOUN_RE.test(text);
}

/* --------------------- markdown-lite helpers ---------------------- */

function isChatMessage(m: unknown): m is ChatMessage {
  return (
    typeof m === "object" &&
    m !== null &&
    "role" in m &&
    "content" in m &&
    ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
    typeof (m as ChatMessage).content === "string"
  );
}

/** **bold** → <strong>; everything else passes through. */
function renderInline(text: string, key: string): ReactNode[] {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) =>
      i % 2 === 1 ? (
        <strong key={`${key}-b${i}`} className="text-foreground">
          {part}
        </strong>
      ) : part ? (
        <span key={`${key}-t${i}`}>{part}</span>
      ) : null
    );
}

/** Split a plain chunk into paragraphs and "- " bullet lists. */
function renderTextBlocks(text: string, key: string): ReactNode[] {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let mode: "text" | "bullets" | null = null;
  let textBuf: string[] = [];
  let bullets: string[] = [];

  const flush = (k: string) => {
    if (mode === "text" && textBuf.length > 0) {
      out.push(
        <p key={`${key}-p-${k}`} className="whitespace-pre-wrap">
          {renderInline(textBuf.join("\n"), `${key}-p-${k}`)}
        </p>
      );
      textBuf = [];
    } else if (mode === "bullets" && bullets.length > 0) {
      out.push(
        <ul key={`${key}-ul-${k}`} className="my-1 list-disc space-y-1 pl-4">
          {bullets.map((b, i) => (
            <li key={i}>{renderInline(b, `${key}-li-${k}-${i}`)}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
    mode = null;
  };

  lines.forEach((line, i) => {
    if (/^\s*- /.test(line)) {
      if (mode === "text") flush(String(i));
      mode = "bullets";
      bullets.push(line.replace(/^\s*- /, ""));
    } else {
      if (mode === "bullets") flush(String(i));
      mode = "text";
      textBuf.push(line);
    }
  });
  flush("end");

  return out;
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code copied to clipboard");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy the code");
    }
  }

  return (
    <div className="relative">
      <pre className="my-2 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-zinc-300">
        {code}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => void handleCopy()}
        aria-label="Copy code"
        className="absolute right-1.5 top-1.5 h-7 gap-1 rounded-md border border-white/10 bg-background/80 px-2 text-[11px] text-muted-foreground hover:text-foreground"
      >
        {copied ? (
          <Check className="size-3" aria-hidden="true" />
        ) : (
          <Copy className="size-3" aria-hidden="true" />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/** Fenced code blocks + bold + bullets — enough for chat replies. */
function renderMarkdownLite(text: string): ReactNode[] {
  const chunks = text.split("```");
  const nodes: ReactNode[] = [];

  chunks.forEach((chunk, i) => {
    if (i % 2 === 1) {
      // fenced block — first line may be a language tag
      const nl = chunk.indexOf("\n");
      const first = nl === -1 ? chunk : chunk.slice(0, nl);
      const code =
        nl !== -1 && /^[a-zA-Z0-9_+#.-]*$/.test(first.trim())
          ? chunk.slice(nl + 1)
          : chunk;
      nodes.push(<CodeBlock key={`code-${i}`} code={code.replace(/\n+$/, "")} />);
    } else if (chunk.trim().length > 0) {
      nodes.push(...renderTextBlocks(chunk, `t${i}`));
    }
  });

  return nodes;
}

/* ------------------------------ page ------------------------------ */

export default function ChatPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [building, setBuilding] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reqIdRef = useRef(0);
  const wasPendingRef = useRef(false);

  /* Auth guard */
  useEffect(() => {
    if (hasHydrated && !token) router.replace("/auth");
  }, [hasHydrated, token, router]);

  /* Restore persisted history once (capped, guarded) */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setMessages(parsed.filter(isChatMessage).slice(-MAX_PERSISTED));
        }
      }
    } catch {
      /* corrupted history — start fresh */
    }
    setHistoryLoaded(true);
  }, []);

  /* Persist after each update — pending state never touches messages */
  useEffect(() => {
    if (!historyLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_PERSISTED)));
    } catch {
      /* storage unavailable — keep chatting anyway */
    }
  }, [messages, historyLoaded]);

  /* Keep the newest message in view */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  /* Re-focus the composer when a reply lands */
  useEffect(() => {
    if (wasPendingRef.current && !pending) inputRef.current?.focus();
    wasPendingRef.current = pending;
  }, [pending]);

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || pending) return;

    const next: ChatMessage[] = [...messages, { role: "user", content }];
    const reqId = ++reqIdRef.current;
    setMessages(next);
    setInput("");
    setPending(true);

    try {
      const res = await assistantChat(next);
      if (reqId !== reqIdRef.current) return; // "New chat" happened mid-flight
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (err) {
      if (reqId === reqIdRef.current) {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Lovify Chat is unavailable right now. Please try again."
        );
      }
    } finally {
      if (reqId === reqIdRef.current) setPending(false);
    }
  }

  async function buildNow(prompt: string) {
    if (building) return;
    setBuilding(true);
    try {
      const project = await createProject(prompt);
      router.push(`/builder/${project.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not start the build. Please try again."
      );
      setBuilding(false);
    }
  }

  function startNewChat() {
    reqIdRef.current++;
    setMessages([]);
    setInput("");
    setPending(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    toast.success("New chat started");
  }

  async function exportChat() {
    if (messages.length === 0) return;
    const text = messages
      .map((m) => `${m.role === "user" ? "You" : "Lovify"}\n${m.content}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Chat copied to clipboard");
    } catch {
      toast.error("Could not copy the chat. Please try again.");
    }
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  /* Centered loader while hydrating or redirecting to /auth */
  if (!hasHydrated || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gold" aria-label="Loading" />
      </div>
    );
  }

  const isEmpty = messages.length === 0 && !pending;

  /* One-tap build CTA: shown under the latest exchange when the user's last
     message reads like an app request — the chat never dead-ends. */
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const buildCtaVisible =
    !isEmpty &&
    !pending &&
    !building &&
    lastUser !== undefined &&
    looksLikeBuildRequest(lastUser.content);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-background/75 px-4 backdrop-blur-xl sm:px-6">
        <BrandLogo href="/dashboard" size={24} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={startNewChat}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          New chat
        </Button>
      </header>

      <main className="flex-1">
        <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col px-4 sm:px-6">
          {isEmpty ? (
            /* ---------------- empty state ---------------- */
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Sparkles className="size-6 text-gold" aria-hidden="true" />
              </div>
              <h1 className="mt-5 font-display text-3xl tracking-normal">Lovify Chat</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Brainstorm, plan, and ask anything &mdash; powered by Z.AI
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                {STARTERS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => void send(chip)}
                    className="min-h-9 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-gold/35 hover:text-foreground"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ---------------- messages ---------------- */
            <div
              ref={scrollRef}
              role="log"
              aria-label="Chat conversation"
              aria-live="polite"
              className="min-h-0 flex-1 overflow-y-auto py-6"
            >
              <div className="flex flex-col gap-4">
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div
                      key={i}
                      className="max-w-[85%] self-end whitespace-pre-wrap rounded-xl rounded-br-md border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm"
                    >
                      {m.content}
                    </div>
                  ) : (
                    <div key={i} className="flex max-w-[92%] gap-2.5 self-start">
                      <span
                        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-primary"
                        aria-hidden="true"
                      >
                        <Sparkles className="size-3.5 text-primary-foreground" />
                      </span>
                      <div className="glass-panel min-w-0 rounded-2xl rounded-tl-md px-4 py-2.5 text-sm">
                        {renderMarkdownLite(m.content)}
                      </div>
                    </div>
                  )
                )}

                {buildCtaVisible && lastUser ? (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3 sm:px-5"
                    aria-label="Build this app with Lovify"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Ready to make it real?
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Lovify will design and code this app — live preview included.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void buildNow(lastUser.content)}
                      className="shrink-0 gap-1.5"
                    >
                      <Hammer className="size-3.5" aria-hidden="true" />
                      Build this app
                    </Button>
                  </div>
                ) : null}

                {pending ? (
                  <div className="flex max-w-[92%] gap-2.5 self-start">
                    <span
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-primary"
                      aria-hidden="true"
                    >
                      <Sparkles className="size-3.5 text-primary-foreground" />
                    </span>
                    <div
                      role="status"
                      aria-label="Lovify is thinking"
                      className="glass-panel flex items-center gap-1 rounded-2xl rounded-tl-md px-4 py-3"
                    >
                      <span className="thinking-dot size-2 rounded-full bg-gold" />
                      <span
                        className="thinking-dot size-2 rounded-full bg-gold"
                        style={{ animationDelay: "0.15s" }}
                      />
                      <span
                        className="thinking-dot size-2 rounded-full bg-gold"
                        style={{ animationDelay: "0.3s" }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* ---------------- composer ---------------- */}
          <div className="shrink-0 pb-4 pt-3">
            <div className="relative rounded-xl border border-white/10 bg-white/[0.03] transition-colors focus-within:border-gold/45">
              <Textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={pending}
                placeholder={messages.length === 0 ? "Ask Lovify anything…" : "Reply to Lovify…"}
                aria-label="Message Lovify Chat"
                className="resize-none border-0 bg-transparent pr-12 shadow-none focus-visible:ring-0"
              />
              <Button
                type="button"
                size="icon"
                onClick={() => void send(input)}
                disabled={pending || input.trim().length === 0}
                aria-label="Send message"
                className="absolute bottom-2 right-2 size-8 rounded-lg p-0"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <SendHorizontal className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[10px] text-muted-foreground/60">
                Lovify Chat can make mistakes &mdash; verify important info.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void exportChat()}
                disabled={messages.length === 0}
                className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <ClipboardCopy className="size-3.5" aria-hidden="true" />
                Export chat
              </Button>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-white/[0.06] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2.5 px-4 sm:px-6">
          <BrandLogo size={20} />
          <span className="text-sm text-muted-foreground">Powered by Z.AI</span>
        </div>
      </footer>
    </div>
  );
}
