"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
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
  onSend: (text: string) => Promise<boolean>;
  className?: string;
}

export function ChatPanel({
  project,
  messages,
  generating,
  sending,
  onSend,
  className,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  /* Keep the latest message in view */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, generating, project.status]);

  async function submit() {
    const text = input.trim();
    if (!text || generating || sending) return;
    setInput("");
    const ok = await onSend(text);
    if (!ok) setInput(text); // give the user their words back on failure
  }

  async function enhance() {
    const text = input.trim();
    if (!text || enhancing || generating) return;
    setEnhancing(true);
    try {
      const res = await enhancePrompt(text);
      setInput(res.prompt);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "The enhancer is busy. Try again in a moment."
      );
    } finally {
      setEnhancing(false);
    }
  }

  return (
    <div className={cn("flex h-full flex-col border-r border-white/[0.06]", className)}>
      {/* Panel header */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.06] px-4 text-sm">
        <Sparkles className="size-4 text-gold" />
        <span className="font-medium text-foreground">Lovify AI</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          powered by Z.AI
        </span>
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
                Describe what to build or change
              </p>
              <p className="max-w-[250px] text-xs text-muted-foreground">
                Ask for anything — layout, copy, colors, whole features.
                Lovify rebuilds the app for you.
              </p>
            </div>
          ) : null}

          {messages.map((m) =>
            m.role === "user" ? (
              <div
                key={m.id}
                className="max-w-[85%] self-end whitespace-pre-wrap rounded-xl rounded-br-md border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm"
              >
                {m.content}
              </div>
            ) : (
              <div key={m.id} className="flex max-w-[92%] self-start gap-2.5">
                <AssistantAvatar />
                <div className="glass-panel min-w-0 flex-1 whitespace-pre-wrap rounded-2xl rounded-tl-md px-4 py-2.5 text-sm">
                  {m.content}
                </div>
              </div>
            )
          )}

          {/* Thinking indicator while generating */}
          {generating ? (
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
          {project.status === "error" ? (
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Rephrase your request and send again.
                </p>
              </div>
            </div>
          ) : null}

          <div ref={bottomRef} aria-hidden />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
            disabled={generating}
            placeholder={
              generating
                ? "Lovify is building — hang tight…"
                : "Ask for changes… e.g. add a dark mode toggle"
            }
            aria-label="Message Lovify"
            className="min-h-16 resize-none border-0 bg-transparent pr-12 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
          />
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={generating || sending || !input.trim()}
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
          <p className="hidden text-[10px] text-muted-foreground/60 sm:block">
            Enter to send · Shift + Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
