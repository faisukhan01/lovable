"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bandage,
  Hammer,
  HelpCircle,
  Loader2,
  MessagesSquare,
  MonitorSmartphone,
  Moon,
  RotateCcw,
  Search,
  SendHorizontal,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { RotatingLabel } from "@/components/builder/building-labels";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, enhancePrompt } from "@/lib/api";
import type { MessageT, ProjectDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ChatMode = "build" | "ask";

/** One-tap directives (Build mode). */
export const QUICK_ACTIONS: { icon: typeof Bandage; label: string; directive: string }[] = [
  {
    icon: Bandage,
    label: "Fix errors",
    directive:
      "Find and fix any bugs, broken interactions or console errors in the app. Keep the design intact.",
  },
  {
    icon: Sparkles,
    label: "Polish UI",
    directive:
      "Polish the UI: refine spacing, typography, alignment and micro-interactions to an Awwwards-level standard without changing features.",
  },
  {
    icon: MonitorSmartphone,
    label: "Make responsive",
    directive:
      "Make the app flawlessly responsive on phones, tablets and desktops — no overflow, no cramped controls, touch-friendly sizes.",
  },
  {
    icon: Moon,
    label: "Dark mode",
    directive:
      "Add an elegant dark mode with a smooth toggle, persisted in localStorage, matching the app's design language.",
  },
  {
    icon: Search,
    label: "SEO pass",
    directive:
      "Improve the app's SEO: proper title, meta description, semantic HTML landmarks, aria labels and Open Graph tags.",
  },
];

/** Slash commands → expanded directives. */
const SLASH_COMMANDS: Record<string, string> = {
  "/fix": QUICK_ACTIONS[0].directive,
  "/polish": QUICK_ACTIONS[1].directive,
  "/responsive": QUICK_ACTIONS[2].directive,
  "/dark": QUICK_ACTIONS[3].directive,
  "/seo": QUICK_ACTIONS[4].directive,
  "/plan": "__PLAN__",
  "/explain": "__ASK__",
};

export function expandSlash(raw: string): { text: string; plan: boolean; ask: boolean } {
  const trimmed = raw.trim();
  const [first, ...rest] = trimmed.split(/\s+/);
  const cmd = SLASH_COMMANDS[first?.toLowerCase() ?? ""];
  const remainder = rest.join(" ");
  if (cmd === "__PLAN__") {
    return { text: remainder || "Plan the next improvement for this app.", plan: true, ask: false };
  }
  if (cmd === "__ASK__") {
    return { text: remainder || "Explain how this app works.", plan: false, ask: true };
  }
  if (cmd) {
    return { text: remainder ? `${cmd} Specifically: ${remainder}` : cmd, plan: false, ask: false };
  }
  return { text: trimmed, plan: false, ask: false };
}

/** Strip internal routing prefixes the backend stores on messages. */
export function displayContent(content: string): string {
  return content.replace(/^\((ask|plan)\)\s*/, "");
}

function AssistantAvatar({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-primary",
        className
      )}
    >
      {children ?? <Sparkles className="size-3.5 text-primary-foreground" />}
    </span>
  );
}

interface ChatPanelProps {
  project: ProjectDetail;
  messages: MessageT[];
  generating: boolean;
  sending: boolean;
  asking: boolean;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  onSend: (text: string) => Promise<boolean>;
  className?: string;
}

export function ChatPanel({
  project,
  messages,
  generating,
  sending,
  asking,
  mode,
  onModeChange,
  onSend,
  className,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  /* Keep the latest message in view */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, generating, asking, project.status]);

  const busy = generating || asking;

  /* The user's latest request — powers the one-tap Retry on a failed build. */
  const lastUserText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return displayContent(messages[i].content);
    }
    return null;
  }, [messages]);

  async function submit() {
    const text = input.trim();
    if (!text || busy || sending) return;
    setInput("");
    const ok = await onSend(text);
    if (!ok) setInput(text); // give the user their words back on failure
  }

  async function enhance() {
    const text = input.trim();
    if (!text || enhancing || generating) return;
    setEnhancing(true);
    try {
      const res = await enhancePrompt(displayContent(text));
      setInput(res.prompt);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "The enhancer is busy. Try again in a moment."
      );
    } finally {
      setEnhancing(false);
    }
  }

  const slashActive = input.trimStart().startsWith("/");
  const slashHint = slashActive ? Object.keys(SLASH_COMMANDS).join("  ") : null;

  return (
    <div className={cn("flex h-full flex-col border-r border-white/[0.06]", className)}>
      {/* Panel header: identity + Build/Ask mode */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 text-sm sm:px-4">
        <Sparkles className="size-4 shrink-0 text-gold" />
        <span className="font-medium text-foreground">Lovify AI</span>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 lg:inline">
          powered by Z.AI
        </span>

        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          <button
            type="button"
            onClick={() => onModeChange("build")}
            aria-pressed={mode === "build"}
            aria-label="Build mode — edit the app"
            title="Build mode — edits your app"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              mode === "build"
                ? "bg-gold/15 text-gold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Hammer className="size-3" />
            Build
          </button>
          <button
            type="button"
            onClick={() => onModeChange("ask")}
            aria-pressed={mode === "ask"}
            aria-label="Ask mode — questions only, no edits"
            title="Ask mode — answers questions, never edits"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              mode === "ask"
                ? "bg-gold/15 text-gold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <HelpCircle className="size-3" />
            Ask
          </button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="flex min-h-full flex-col gap-3 px-4 py-4">
          {messages.length === 0 && !generating ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Sparkles className="size-5 text-gold" />
              </div>
              <p className="font-display text-lg tracking-normal">
                {mode === "build" ? "Describe what to build or change" : "Ask anything about this app"}
              </p>
              <p className="max-w-[250px] text-xs text-muted-foreground">
                {mode === "build"
                  ? "Ask for anything — layout, copy, colors, whole features. Lovify rebuilds the app for you."
                  : "How does the code work? Where's that bug? Ask mode explains without touching your app."}
              </p>
            </div>
          ) : null}

          {messages.map((m) =>
            m.role === "user" ? (
              <div
                key={m.id}
                className="max-w-[85%] self-end whitespace-pre-wrap rounded-xl rounded-br-md border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm"
              >
                {displayContent(m.content)}
              </div>
            ) : (
              <div key={m.id} className="flex max-w-[92%] self-start gap-2.5">
                <AssistantAvatar />
                <div className="glass-panel min-w-0 flex-1 whitespace-pre-wrap rounded-2xl rounded-tl-md px-4 py-2.5 text-sm">
                  {displayContent(m.content)}
                </div>
              </div>
            )
          )}

          {/* Thinking indicator while generating or asking */}
          {busy ? (
            <div className="flex max-w-[92%] self-start gap-2.5">
              <AssistantAvatar />
              <div className="glass-panel flex items-center gap-3 rounded-2xl rounded-tl-md px-4 py-3">
                <span aria-hidden className="flex items-center gap-1">
                  <span className="thinking-dot size-2 rounded-full bg-gold" />
                  <span
                    className="thinking-dot size-2 rounded-full bg-gold"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="thinking-dot size-2 rounded-full bg-gold"
                    style={{ animationDelay: "0.3s" }}
                  />
                </span>
                <RotatingLabel className="text-sm text-muted-foreground" />
              </div>
            </div>
          ) : null}

          {/* Error card */}
          {mode === "build" && project.status === "error" ? (
            <div className="flex max-w-[92%] self-start gap-2.5">
              <AssistantAvatar className="border border-rose-400/30 bg-rose-500/15">
                <AlertTriangle className="size-3.5 text-rose-400" />
              </AssistantAvatar>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm">
                <p className="font-medium text-rose-200">
                  The last change failed
                </p>
                {project.error ? (
                  <p className="mt-1 break-words text-muted-foreground">
                    {project.error}
                  </p>
                ) : null}
                {lastUserText && !busy ? (
                  <button
                    type="button"
                    onClick={() => void onSend(lastUserText)}
                    disabled={sending}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-rose-400/40 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3" />
                    )}
                    Retry build
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div ref={bottomRef} aria-hidden />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* quick actions (Build mode) */}
        {mode === "build" && !busy ? (
          <div className="marquee-mask mb-2 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                type="button"
                onClick={() => void onSend(qa.directive)}
                disabled={sending}
                title={qa.directive}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-gold/35 hover:text-foreground disabled:opacity-50"
              >
                <qa.icon className="size-3 text-gold" />
                {qa.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative rounded-xl border border-white/10 bg-white/[0.03] transition-colors focus-within:border-gold/45">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={2}
            disabled={busy}
            placeholder={
              busy
                ? mode === "ask"
                  ? "Z.AI is thinking…"
                  : "Lovify is building — hang tight…"
                : mode === "ask"
                  ? "Ask about the code, features, or bugs…"
                  : "Ask for changes… /plan /fix /polish /dark"
            }
            aria-label="Message Lovify"
            className="min-h-16 resize-none border-0 bg-transparent pr-12 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
          />
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={busy || sending || !input.trim()}
            aria-label="Send message"
            className="absolute bottom-2 right-2 size-8 rounded-lg p-0"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizontal className="size-4" />
            )}
          </Button>
        </div>

        {/* slash hint */}
        {slashHint ? (
          <p className="mt-1.5 px-1 font-mono text-[10px] text-muted-foreground/70">
            {slashHint}
          </p>
        ) : null}

        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => void enhance()}
            disabled={enhancing || generating || input.trim().length < 8}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-[11px] text-gold transition-colors hover:bg-gold/20 disabled:opacity-40"
            title="Let Z.AI rewrite your request into a richer, more specific brief"
          >
            {enhancing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <WandSparkles className="size-3" />
            )}
            Enhance prompt
          </button>
          <p className="hidden items-center gap-1 text-[10px] text-muted-foreground/60 sm:flex">
            {mode === "ask" ? (
              <>
                <MessagesSquare className="size-3" />
                Ask mode never edits your app
              </>
            ) : (
              "Enter to send · /plan for a roadmap"
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
