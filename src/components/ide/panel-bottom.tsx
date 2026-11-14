"use client";

/**
 * The VS Code bottom panel — PROBLEMS / OUTPUT / TERMINAL tabs with the
 * classic header (tab row left, collapse + close right). The panel lives
 * inside the editor column, exactly like the real IDE.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type PanelTab = "problems" | "output" | "terminal";

export function BottomPanel({
  tabs,
  active,
  onActive,
  onClose,
  height = 220,
  children,
}: {
  /** Which tabs to show, in order. */
  tabs: PanelTab[];
  active: PanelTab;
  onActive: (t: PanelTab) => void;
  onClose: () => void;
  height?: number;
  children: ReactNode;
}) {
  return (
    <section
      aria-label="Panel"
      className="flex shrink-0 flex-col border-t border-[#2b2b2b] bg-[#181818]"
      style={{ height }}
    >
      <header className="flex h-9 shrink-0 items-center justify-between pl-4 pr-1.5">
        <div role="tablist" aria-label="Panel views" className="flex items-center gap-4">
          {tabs.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={active === t}
              onClick={() => onActive(t)}
              className={cn(
                "relative h-9 text-[11px] font-medium uppercase tracking-[0.08em] outline-none transition-colors",
                active === t
                  ? "text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {t}
              {active === t ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-[1.5px] bg-gold"
                />
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Hide panel"
            title="Hide panel (⌘J)"
            onClick={onClose}
            className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Close panel"
            title="Close panel"
            onClick={onClose}
            className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

/* ------------------------------- problems ------------------------------- */

export function ProblemsView({ error }: { error?: string | null }) {
  if (error) {
    return (
      <div className="flex h-full flex-col gap-1 overflow-y-auto px-4 py-3 font-mono text-xs">
        <p className="text-rose-300">✖ last build failed</p>
        <p className="whitespace-pre-wrap text-zinc-400">{error}</p>
        <p className="mt-1 text-zinc-500">Ask the AI chat to “fix errors” and rebuild.</p>
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center gap-2 text-xs text-zinc-500">
      <CheckCircle2 className="size-3.5 text-emerald-400/80" aria-hidden="true" />
      No problems have been detected in the workspace.
    </div>
  );
}

/* -------------------------------- output -------------------------------- */

export interface OutputLine {
  kind: "info" | "ok" | "warn" | "error" | "cmd";
  text: string;
}

export function OutputView({ lines }: { lines: OutputLine[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines.length]);

  return (
    <div
      ref={ref}
      role="log"
      aria-label="Output"
      className="h-full overflow-y-auto px-4 py-2 font-mono text-[11.5px] leading-[18px]"
    >
      {lines.length === 0 ? (
        <p className="text-zinc-600">Waiting for the first build…</p>
      ) : (
        lines.map((l, i) => (
          <p
            key={i}
            className={cn(
              "whitespace-pre-wrap",
              l.kind === "ok" && "text-emerald-300/90",
              l.kind === "warn" && "text-amber-300/90",
              l.kind === "error" && "text-rose-300",
              l.kind === "cmd" && "text-zinc-500",
              l.kind === "info" && "text-zinc-300"
            )}
          >
            {l.text}
          </p>
        ))
      )}
    </div>
  );
}

/* ------------------------------- terminal ------------------------------- */

const PROMPT = "lovify";

export function TerminalView({
  intro = [],
  files = [],
  statusLine,
  onOpenPreview,
}: {
  intro?: string[];
  files?: string[];
  statusLine?: string;
  onOpenPreview?: () => void;
}) {
  const [lines, setLines] = useState<string[]>([
    "Lovify terminal — type 'help' to see available commands.",
    ...intro,
  ]);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [lines]);

  function run(raw: string) {
    const cmd = raw.trim();
    const out: string[] = [`➜ ${PROMPT} $ ${cmd}`];
    const [name, ...args] = cmd.split(/\s+/);
    switch ((name || "").toLowerCase()) {
      case "":
        break;
      case "help":
        out.push(
          "help        show this list",
          "ls          list workspace files",
          "status      build status",
          "open        open the app preview",
          "echo <txt>  print text",
          "date        current time",
          "clear       clear the terminal"
        );
        break;
      case "ls":
        out.push(files.length ? files.join("   ") : "(no files yet — build the app first)");
        break;
      case "status":
        out.push(statusLine || "workspace idle");
        break;
      case "open":
        if (onOpenPreview) {
          onOpenPreview();
          out.push("opening preview…");
        } else out.push("no preview available here");
        break;
      case "echo":
        out.push(args.join(" "));
        break;
      case "date":
        out.push(new Date().toString());
        break;
      case "clear":
        setLines([]);
        setValue("");
        return;
      default:
        out.push(`command not found: ${name} — try 'help'`);
    }
    setLines((prev) => [...prev, ...out]);
  }

  return (
    <div
      className="flex h-full flex-col bg-[#181818] font-mono text-[12px] leading-[19px]"
      onClick={() => inputRef.current?.focus()}
      role="terminal"
      aria-label="Terminal"
    >
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-2 text-zinc-300">
        {lines.map((l, i) => (
          <p key={i} className="whitespace-pre-wrap break-all">
            {l}
          </p>
        ))}
        {/* live input row */}
        <p className="flex items-center gap-1.5">
          <span className="text-emerald-400">➜</span>
          <span className="text-gold">{PROMPT}</span>
          <span className="text-zinc-500">$</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                run(value);
                if (value.trim()) setHistory((h) => [value, ...h]);
                setValue("");
                setHistIdx(-1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const next = Math.min(histIdx + 1, history.length - 1);
                if (next >= 0) {
                  setHistIdx(next);
                  setValue(history[next]);
                }
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const next = histIdx - 1;
                setHistIdx(next);
                setValue(next >= 0 ? history[next] : "");
              }
            }}
            aria-label="Terminal input"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            className="ml-1 min-w-0 flex-1 bg-transparent text-zinc-100 caret-gold outline-none"
          />
        </p>
      </div>
    </div>
  );
}
