"use client";

/**
 * The Cursor-style AI chat dock — right sidebar with a CHAT header,
 * plain assistant text (no bubbles), "Thinking…" state, tool-chip row
 * and the composer with the Agent/Ask mode picker. Wired to the same
 * handlers as the mobile chat panel.
 */

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Hammer,
  HelpCircle,
  Loader2,
  Plus,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { RotatingLabel } from "@/components/builder/building-labels";
import { QUICK_ACTIONS, displayContent, type ChatMode } from "@/components/builder/chat-panel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError, enhancePrompt } from "@/lib/api";
import type { MessageT } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatDockProps {
  /** Display name in the identity row ("Copilot · Greeting" analog). */
  projectName: string;
  messages: MessageT[];
  generating: boolean;
  /** Text for the building chip (e.g. "building v3"); null hides it. */
  buildLabel?: string | null;
  /** Non-null shows the error card. */
  error?: string | null;
  sending: boolean;
  asking: boolean;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  onSend: (text: string) => Promise<boolean>;
  onClose: () => void;
}

export function ChatDock({
  projectName,
  messages,
  generating,
  buildLabel,
  error,
  sending,
  asking,
  mode,
  onModeChange,
  onSend,
  onClose,
}: ChatDockProps) {
  const [input, setInput] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const busy = generating || asking;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, generating, asking]);

  async function submit() {
    const text = input.trim();
    if (!text || busy || sending) return;
    setInput("");
    const ok = await onSend(text);
    if (!ok) setInput(text);
  }

  async function enhance() {
    const text = input.trim();
    if (!text || enhancing || generating) return;
    setEnhancing(true);
    try {
      const res = await enhancePrompt(displayContent(text));
      setInput(res.prompt);
      toast.success("Prompt upgraded by Z.AI");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "The enhancer is busy. Try again in a moment."
      );
    } finally {
      setEnhancing(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-[#2b2b2b] bg-[#181818]">
      {/* header — CHAT + actions, exactly like the Cursor column */}
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-[#2b2b2b] pl-4 pr-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-300">
          Chat
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            aria-label="New chat"
            title="New chat"
            onClick={() => {
              setInput("");
              taRef.current?.focus();
              toast("Fresh chat — ask for your next change.");
            }}
            className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Close chat"
            title="Close (⌘L)"
            onClick={onClose}
            className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* identity row — "Lovify · {name}" like "Copilot · Greeting" */}
      <div className="flex shrink-0 items-center gap-1.5 px-4 py-2.5">
        <Sparkles className="size-3.5 text-gold" aria-hidden="true" />
        <span className="text-[12px] text-zinc-400">
          Lovify <span className="text-zinc-600">·</span>{" "}
          <span className="text-zinc-300">{projectName}</span>
        </span>
      </div>

      {/* messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3" role="log" aria-label="Chat messages">
        {messages.length === 0 && !generating ? (
          <div className="flex flex-col items-start gap-2 pt-4 text-left">
            <p className="text-[13px] font-medium text-zinc-200">
              {mode === "build" ? "What should we change?" : "Ask anything about this app"}
            </p>
            <p className="text-[12px] leading-relaxed text-zinc-500">
              {mode === "build"
                ? "Describe a feature, a fix or a vibe — Lovify rebuilds the app in place."
                : "Ask mode explains the code without touching your app."}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 pt-1">
          {messages.map((m) =>
            m.role === "user" ? (
              <div
                key={m.id}
                className="max-w-[88%] self-end whitespace-pre-wrap rounded-xl border border-white/[0.07] bg-white/[0.06] px-3.5 py-2 text-[12.5px] leading-relaxed text-zinc-100"
              >
                {displayContent(m.content)}
              </div>
            ) : (
              <div key={m.id} className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-300">
                {displayContent(m.content)}
              </div>
            )
          )}

          {busy ? (
            <div className="flex items-center gap-2 text-[12px] text-zinc-500">
              {buildLabel ? (
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-gold">
                  {buildLabel}
                </span>
              ) : null}
              <span
                aria-hidden="true"
                className="flex items-center gap-1"
              >
                <span className="thinking-dot size-1.5 rounded-full bg-gold" />
                <span className="thinking-dot size-1.5 rounded-full bg-gold" style={{ animationDelay: "0.15s" }} />
                <span className="thinking-dot size-1.5 rounded-full bg-gold" style={{ animationDelay: "0.3s" }} />
              </span>
              <RotatingLabel />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-[12.5px]">
              <p className="flex items-center gap-1.5 font-medium text-rose-200">
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                The last change failed
              </p>
              <p className="mt-1 break-words text-[11.5px] text-zinc-400">{error}</p>
            </div>
          ) : null}
        </div>
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* composer — Cursor box with +, mode picker and send */}
      <div className="shrink-0 px-3 pb-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] transition-colors focus-within:border-gold/45">
          <textarea
            ref={taRef}
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
            aria-label="Message Lovify"
            placeholder={
              busy
                ? "Lovify is working — hang tight…"
                : mode === "ask"
                  ? "Ask about the code…"
                  : "Chat with Lovify — try /fix /polish /dark"
            }
            className="w-full resize-none bg-transparent px-3 pt-2.5 text-[12.5px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <div className="flex items-center gap-1 px-2 pb-2 pt-0.5">
            {/* + = quick directives */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Quick directives"
                title="Quick directives"
                disabled={busy || sending}
                className="inline-flex size-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100 disabled:opacity-40"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                className="w-60 border-[#454545] bg-[#1f1f1f] text-zinc-200"
              >
                <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                  One-tap directives
                </DropdownMenuLabel>
                {QUICK_ACTIONS.map((qa) => (
                  <DropdownMenuItem
                    key={qa.label}
                    onSelect={() => void onSend(qa.directive)}
                    className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
                  >
                    <qa.icon className="size-3.5 text-gold" aria-hidden="true" />
                    {qa.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* mode picker — Agent / Ask */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Chat mode"
                title={mode === "build" ? "Agent mode — edits your app" : "Ask mode — answers only"}
                className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11.5px] text-zinc-300 transition-colors hover:bg-white/[0.08]"
              >
                {mode === "build" ? (
                  <>
                    <Hammer className="size-3 text-gold" aria-hidden="true" /> Agent
                  </>
                ) : (
                  <>
                    <HelpCircle className="size-3 text-gold" aria-hidden="true" /> Ask
                  </>
                )}
                <span className="text-zinc-500" aria-hidden="true">⌄</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                className="w-52 border-[#454545] bg-[#1f1f1f] text-zinc-200"
              >
                <DropdownMenuItem
                  onSelect={() => onModeChange("build")}
                  className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
                >
                  <Hammer className="size-3.5" aria-hidden="true" />
                  <span className="flex-1">Agent</span>
                  {mode === "build" ? <span className="text-gold">●</span> : null}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onModeChange("ask")}
                  className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
                >
                  <HelpCircle className="size-3.5" aria-hidden="true" />
                  <span className="flex-1">Ask — never edits</span>
                  {mode === "ask" ? <span className="text-gold">●</span> : null}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.08]" />
                <DropdownMenuItem
                  onSelect={() => void onSend("Draft a step-by-step plan for the next improvement to this app.")}
                  className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
                >
                  <Sparkles className="size-3.5 text-gold" aria-hidden="true" />
                  /plan — roadmap only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="ml-auto flex items-center gap-0.5">
              {input.trim().length >= 8 ? (
                <button
                  type="button"
                  aria-label="Enhance prompt with Z.AI"
                  title="Enhance prompt"
                  onClick={() => void enhance()}
                  disabled={enhancing}
                  className="inline-flex size-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-gold disabled:opacity-40"
                >
                  {enhancing ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <WandSparkles className="size-3.5" aria-hidden="true" />
                  )}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Send message"
                title="Send (Enter)"
                onClick={() => void submit()}
                disabled={busy || sending || !input.trim()}
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-md transition-all disabled:opacity-30",
                  input.trim() && !busy && !sending
                    ? "bg-gold text-black hover:opacity-90"
                    : "text-zinc-400"
                )}
              >
                {sending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowUp className="size-3.5" aria-hidden="true" />
                )}
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
