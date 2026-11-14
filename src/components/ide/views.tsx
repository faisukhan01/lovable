"use client";

/**
 * The activity-bar views — Search, Source Control, Run and Debug and
 * Extensions, all with VS Code sidebar metrics (22px rows, 13px text,
 * hairline hovers) and the MONOLITH gold reserved for state.
 */

import { useMemo, useState, type ReactNode } from "react";
import {
  Bug,
  Check,
  GitBranch,
  GitCompareArrows,
  History,
  Play,
  RotateCcw,
  Search as SearchIcon,
  Sparkles,
  Zap,
} from "lucide-react";
import { formatDistanceToNow, isValid } from "date-fns";

import { FileIcon } from "@/components/ide/editor-chrome";
import { displayContent } from "@/components/builder/chat-panel";
import type { VFile } from "@/lib/project-files";
import type { ProjectSummary, VersionT } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------ view header ----------------------------- */

export function ViewHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between px-4">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
        {title}
      </span>
      {actions ? <div className="flex items-center gap-0.5">{actions}</div> : null}
    </div>
  );
}

/** One 22px tree/view row. */
export function ViewRow({
  active,
  onClick,
  indent = 0,
  children,
  className,
  title,
}: {
  active?: boolean;
  onClick?: () => void;
  indent?: number;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex h-[22px] w-full items-center gap-1.5 pl-[10px] pr-3 text-left text-[13px] outline-none transition-colors",
        active
          ? "bg-white/[0.07] text-zinc-100"
          : "text-zinc-400 hover:bg-white/[0.045] hover:text-zinc-200",
        className
      )}
      style={{ paddingLeft: 10 + indent * 12 }}
    >
      {children}
    </button>
  );
}

/* ------------------------------ search views ---------------------------- */

function highlight(text: string, q: string): ReactNode {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-gold/30 text-zinc-100">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function CodeSearchView({
  files,
  onOpenFile,
}: {
  files: VFile[];
  onOpenFile: (path: string) => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim();

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const out: { path: string; line: number; text: string }[] = [];
    for (const f of files) {
      const ls = f.content.split("\n");
      for (let i = 0; i < ls.length; i++) {
        if (out.length >= 60) break;
        if (ls[i].toLowerCase().includes(query.toLowerCase())) {
          out.push({ path: f.path, line: i + 1, text: ls[i].trim().slice(0, 160) });
        }
      }
    }
    return out;
  }, [files, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof results>();
    for (const r of results) {
      const arr = map.get(r.path) ?? [];
      arr.push(r);
      map.set(r.path, arr);
    }
    return [...map.entries()];
  }, [results]);

  const total = results.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title="Search" />
      <div className="px-3 pb-2">
        <div className="flex h-7 items-center gap-1.5 rounded-[3px] border border-gold/40 bg-[#313131] px-2">
          <SearchIcon className="size-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            aria-label="Search in workspace"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
          />
          {q ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQ("")}
              className="text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          ) : null}
        </div>
        {query.length >= 2 ? (
          <p className="mt-1.5 px-1 text-[11px] text-zinc-500">
            {total} result{total === 1 ? "" : "s"} in {grouped.length} file
            {grouped.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {query.length < 2 ? (
          <p className="px-4 pt-6 text-center text-[11.5px] leading-relaxed text-zinc-600">
            Type at least two characters to search the generated code.
          </p>
        ) : total === 0 ? (
          <p className="px-4 pt-6 text-center text-[11.5px] text-zinc-600">
            No results found.
          </p>
        ) : (
          grouped.map(([path, rows]) => (
            <div key={path}>
              <ViewRow indent={0} onClick={() => onOpenFile(path)}>
                <FileIcon
                  lang={rows.length ? (files.find((f) => f.path === path)?.lang ?? "markdown") : "markdown"}
                />
                <span className="truncate text-zinc-300">{path}</span>
                <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 text-[10px] text-zinc-400">
                  {rows.length}
                </span>
              </ViewRow>
              {rows.map((r) => (
                <ViewRow key={`${r.path}:${r.line}`} indent={2} onClick={() => onOpenFile(r.path)}>
                  <span className="w-7 shrink-0 text-right font-mono text-[10.5px] text-zinc-600">
                    {r.line}
                  </span>
                  <span className="truncate font-mono text-[11.5px] text-zinc-400">
                    {highlight(r.text, query)}
                  </span>
                </ViewRow>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ProjectSearchView({
  projects,
  onOpen,
  onNewProject,
}: {
  projects: ProjectSummary[];
  onOpen: (id: string) => void;
  onNewProject?: () => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const hits = query
    ? projects.filter((p) => p.name.toLowerCase().includes(query))
    : projects;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title="Search" />
      <div className="px-3 pb-2">
        <div className="flex h-7 items-center gap-1.5 rounded-[3px] border border-gold/40 bg-[#313131] px-2">
          <SearchIcon className="size-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search apps"
            aria-label="Search apps"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {hits.length === 0 ? (
          <p className="px-4 pt-6 text-center text-[11.5px] text-zinc-600">
            No apps match “{q}”.
          </p>
        ) : (
          hits.map((p) => (
            <ViewRow key={p.id} onClick={() => onOpen(p.id)}>
              <FileIcon lang="html" />
              <span className="truncate">{p.name}</span>
              {p.status === "generating" ? (
                <span className="ml-auto size-1.5 shrink-0 animate-pulse rounded-full bg-gold" aria-hidden="true" />
              ) : p.published_slug ? (
                <Check className="ml-auto size-3 shrink-0 text-emerald-400/80" aria-hidden="true" />
              ) : null}
            </ViewRow>
          ))
        )}
        {onNewProject ? (
          <ViewRow onClick={onNewProject}>
            <span className="flex size-3.5 items-center justify-center text-gold" aria-hidden="true">＋</span>
            <span className="text-zinc-300">New project…</span>
          </ViewRow>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------- source control view ------------------------- */

function relative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : "";
}

export function ScmView({
  versions,
  currentVersion,
  generating,
  restoringVersion,
  onCompare,
  onRestore,
}: {
  versions: VersionT[];
  currentVersion: number;
  generating: boolean;
  restoringVersion: number | null;
  onCompare: (from: number | null, to: number) => void;
  onRestore: (version: number) => void;
}) {
  const list = [...versions].sort((a, b) => b.version - a.version);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title="Source Control"
        actions={
          <span className="rounded-full bg-white/[0.07] px-1.5 font-mono text-[10px] text-zinc-400">
            {list.length}
          </span>
        }
      />
      <ViewRow indent={0} active className="cursor-default">
        <GitBranch className="size-3.5 shrink-0 text-gold" aria-hidden="true" />
        <span className="truncate">main</span>
        <span className="ml-auto font-mono text-[10.5px] text-zinc-500">
          v{currentVersion}
        </span>
      </ViewRow>

      <div className="mt-1 min-h-0 flex-1 overflow-y-auto pb-3" role="list" aria-label="Version history">
        {list.length === 0 ? (
          <p className="px-4 pt-6 text-center text-[11.5px] leading-relaxed text-zinc-600">
            No commits yet — every build lands here like a commit.
          </p>
        ) : (
          list.map((v, idx) => {
            const current = v.version === currentVersion;
            return (
              <div key={v.id} className="group/v relative">
                <ViewRow
                  indent={1}
                  title={`Compare v${v.version} with the adjacent version`}
                  onClick={() => {
                    if (idx + 1 < list.length) onCompare(list[idx + 1].version, v.version);
                    else if (idx > 0) onCompare(v.version, list[idx - 1].version);
                  }}
                >
                  <History
                    className={cn("size-3.5 shrink-0", current ? "text-gold" : "text-zinc-500")}
                    aria-hidden="true"
                  />
                  <span className="shrink-0 font-mono text-[10.5px]">v{v.version}</span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-500">
                    {displayContent(v.label).slice(0, 26) || "build"}
                  </span>
                  <span className="hidden shrink-0 text-[10px] text-zinc-600 group-hover/v:hidden sm:inline">
                    {relative(v.created_at)}
                  </span>
                  {current ? (
                    <Check className="size-3 shrink-0 text-gold" aria-hidden="true" />
                  ) : null}
                </ViewRow>
                {!current && !generating ? (
                  <button
                    type="button"
                    aria-label={`Restore version ${v.version}`}
                    title={`Restore v${v.version}`}
                    disabled={restoringVersion !== null}
                    onClick={() => onRestore(v.version)}
                    className="absolute right-2 top-1/2 hidden size-5 -translate-y-1/2 items-center justify-center rounded text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100 disabled:opacity-40 group-hover/v:inline-flex"
                  >
                    <RotateCcw className="size-3" />
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <p className="shrink-0 px-4 pb-3 text-[11px] leading-relaxed text-zinc-600">
        <GitCompareArrows className="mr-1 inline size-3" aria-hidden="true" />
        Click a version to diff it against its neighbor.
      </p>
    </div>
  );
}

/* --------------------------- run and debug view -------------------------- */

export function DebugView({ onRun, generating }: { onRun?: () => void; generating?: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title="Run and Debug" />
      <div className="flex flex-1 flex-col items-center gap-3 px-6 pt-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
          <Bug className="size-5 text-zinc-400" aria-hidden="true" />
        </div>
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Run your app right here — no build step, no config.
        </p>
        {onRun ? (
          <button
            type="button"
            onClick={onRun}
            disabled={generating}
            className="inline-flex h-8 items-center gap-2 rounded-md bg-gold px-4 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Play className="size-3.5" aria-hidden="true" />
            {generating ? "Building…" : "Run the App"}
          </button>
        ) : (
          <p className="text-[11px] text-zinc-600">Open an app to run it.</p>
        )}
        <p className="pt-2 text-[11px] leading-relaxed text-zinc-600">
          Lovify runs the generated bundle in a sandboxed live preview.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------- extensions view ---------------------------- */

const EXTENSIONS = [
  {
    name: "Z.AI Brain",
    desc: "Generates and edits your app from plain language.",
    icon: Sparkles,
    badge: "enabled",
  },
  {
    name: "Live Preview",
    desc: "Sandboxed iframe runner with device modes.",
    icon: Zap,
    badge: "enabled",
  },
  {
    name: "Version Timeline",
    desc: "Every build is a restorable commit.",
    icon: History,
    badge: "enabled",
  },
];

export function ExtensionsView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title="Extensions"
        actions={
          <span className="rounded-full bg-white/[0.07] px-1.5 font-mono text-[10px] text-zinc-400">
            {EXTENSIONS.length}
          </span>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {EXTENSIONS.map((ext) => (
          <div
            key={ext.name}
            className="mx-2 mb-1 flex gap-2.5 rounded-[3px] border border-transparent px-2 py-2 transition-colors hover:bg-white/[0.04]"
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
              <ext.icon className="size-4 text-gold" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium text-zinc-200">{ext.name}</span>
                <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 text-[9.5px] uppercase tracking-wide text-zinc-400">
                  {ext.badge}
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{ext.desc}</span>
            </span>
          </div>
        ))}
        <p className="px-4 pt-3 text-center text-[11px] leading-relaxed text-zinc-600">
          Lovify ships with its power tools built in — nothing to install.
        </p>
      </div>
    </div>
  );
}
