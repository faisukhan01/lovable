"use client";

import { useState } from "react";
import {
  ChevronRight,
  Compass,
  FileCode2,
  Loader2,
  MessageSquare,
  PanelLeft,
  Plus,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow, isValid } from "date-fns";

import type { ProjectSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

function relative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : "";
}

/**
 * The "Welcome" editor tab — Lovify's take on the VS Code welcome page
 * crossed with Cursor's center composer: wordmark, prompt box, Start /
 * Recent columns and a shortcut strip.
 */
export function WelcomeEditor({
  projects,
  loading,
  creating,
  onNewProject,
  onOpen,
  onBuild,
  sidebarHint = true,
}: {
  projects: ProjectSummary[];
  loading: boolean;
  /** True while a prompt is being sent to the builder. */
  creating?: boolean;
  onNewProject: () => void;
  onOpen: (id: string) => void;
  /** Direct-build from the center composer (Cursor style). */
  onBuild: (prompt: string) => void;
  /** Show the ⌘B side-bar hint card. */
  sidebarHint?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function submit() {
    const value = draft.trim();
    if (!value || creating) return;
    setDraft("");
    onBuild(value);
  }

  const recent = projects.slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      {/* wordmark */}
      <div className="text-center">
        <h1 className="font-display text-5xl tracking-normal sm:text-6xl">
          Lovify
        </h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          The AI app builder — powered by Z.AI
        </p>
      </div>

      {/* center composer — the Cursor moment */}
      <div className="relative mx-auto mt-8 max-w-2xl">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gold/50"
        />
        <div className="rounded-xl border border-white/10 bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] transition-colors focus-within:border-gold/40">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            disabled={creating}
            aria-label="Describe the app you want to build"
            placeholder="Describe your app in one sentence — a booking site for my studio with a calendar and pricing cards…"
            className="w-full resize-none bg-transparent p-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none sm:p-5"
          />
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] px-3 py-2.5">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <Sparkles className="size-3 text-gold" aria-hidden="true" />
              Z.AI builds it
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={creating || !draft.trim()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {creating ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-3.5" aria-hidden="true" />
              )}
              {creating ? "Building…" : "Build"}
            </button>
          </div>
        </div>
      </div>

      {/* start / recent columns */}
      <div className="mt-10 grid gap-8 text-left sm:grid-cols-2 sm:gap-10">
        {/* start */}
        <section aria-label="Start">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Start
          </h2>
          <ul className="mt-3 space-y-0.5">
            <StartRow
              icon={<Plus className="size-4 text-gold" aria-hidden="true" />}
              label="New project"
              onClick={onNewProject}
            />
            <StartRow
              icon={<MessageSquare className="size-4 text-gold" aria-hidden="true" />}
              label="Open Lovify Chat"
              href="/chat"
            />
            <StartRow
              icon={<Compass className="size-4 text-gold" aria-hidden="true" />}
              label="Explore gallery"
              href="/explore"
            />
            <StartRow
              icon={<Sparkles className="size-4 text-gold" aria-hidden="true" />}
              label="Templates in the explorer"
              onClick={onNewProject}
              chevron={false}
            />
          </ul>
        </section>

        {/* recent */}
        <section aria-label="Recent apps">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Recent
          </h2>
          <ul className="mt-3 space-y-0.5">
            {loading ? (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <li
                    key={i}
                    className="h-8 animate-pulse rounded-md bg-white/[0.04]"
                  />
                ))}
              </>
            ) : recent.length === 0 ? (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">
                Nothing yet — your first build will appear here.
              </li>
            ) : (
              recent.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(p.id)}
                    className="group flex h-8 w-full items-center gap-2 rounded-md px-2 text-left outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <FileCode2
                      className={cn(
                        "size-3.5 shrink-0",
                        p.status === "error" ? "text-rose-300" : "text-gold/80",
                        p.status === "generating" && "animate-pulse"
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-300 group-hover:text-foreground">
                      {p.name}
                    </span>
                    <span className="hidden shrink-0 font-mono text-[10px] text-zinc-600 sm:inline">
                      {relative(p.updated_at || p.created_at)}
                    </span>
                    {p.status === "generating" ? (
                      <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-gold" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      {/* shortcut strip */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
        <ShortcutCard keys={["⌘", "K"]} label="Command palette" />
        {sidebarHint ? (
          <ShortcutCard
            icon={<PanelLeft className="size-3" aria-hidden="true" />}
            keys={["⌘", "B"]}
            label="Toggle explorer"
          />
        ) : null}
        <ShortcutCard keys={["Enter"]} label="Build from composer" />
      </div>
    </div>
  );
}

function StartRow({
  icon,
  label,
  onClick,
  href,
  chevron = true,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  chevron?: boolean;
}) {
  const inner = (
    <>
      {icon}
      <span className="flex-1 text-[13px] text-zinc-300 group-hover:text-foreground">
        {label}
      </span>
      {chevron ? (
        <ChevronRight
          className="size-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      ) : null}
    </>
  );
  const cls =
    "group flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-1 focus-visible:ring-ring";
  return (
    <li>
      {href ? (
        <a href={href} className={cls}>
          {inner}
        </a>
      ) : (
        <button type="button" onClick={onClick} className={cls}>
          {inner}
        </button>
      )}
    </li>
  );
}

function ShortcutCard({
  keys,
  label,
  icon,
}: {
  keys: string[];
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-1.5">
      {icon}
      <span className="flex items-center gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300"
          >
            {k}
          </kbd>
        ))}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}
