"use client";

import { formatDistanceToNow, isValid } from "date-fns";
import {
  Check,
  Download,
  FileCode2,
  FolderOpen,
  GitCompareArrows,
  Globe,
  History,
  Monitor,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Rocket,
  type LucideIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { displayContent } from "@/components/builder/chat-panel";
import type { ProjectDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BuilderExplorerTab = "preview" | "code" | "diff";

function relative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : "";
}

/**
 * VS Code explorer for a project workspace — the app as a folder:
 * editor files (preview / index.html / diff), the full version history
 * (click to compare, hover to restore) and app actions on the root row.
 */
export function BuilderExplorer({
  project,
  activeTab,
  diffTo,
  restoringVersion,
  generating,
  publishing,
  onOpenTab,
  onOpenDiff,
  onRestore,
  onRename,
  onPublish,
  onDownload,
}: {
  project: ProjectDetail;
  activeTab: BuilderExplorerTab;
  /** Version currently opened in the diff "compare" slot (for the row mark). */
  diffTo: number | null;
  restoringVersion: number | null;
  generating: boolean;
  publishing: boolean;
  onOpenTab: (tab: BuilderExplorerTab) => void;
  onOpenDiff: (from: number | null, to: number) => void;
  onRestore: (version: number) => void;
  onRename: () => void;
  onPublish: () => void;
  onDownload: () => void;
}) {
  const files: { id: BuilderExplorerTab; label: string; icon: LucideIcon }[] = [
    { id: "preview", label: "preview", icon: Monitor },
    { id: "code", label: "index.html", icon: FileCode2 },
    { id: "diff", label: "versions.diff", icon: GitCompareArrows },
  ];

  const versions = [...project.versions].sort((a, b) => b.version - a.version);
  const lastMsg = project.messages[project.messages.length - 1];

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-4 text-[13px]">
      {/* section caption */}
      <div className="flex h-8 shrink-0 items-center justify-between px-4">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          Explorer
        </span>
      </div>

      {/* ------------------------------ project root ------------------------------ */}
      <div className="group mx-2 mb-1 flex h-7 items-center gap-1.5 rounded-md pl-1 pr-1 transition-colors hover:bg-white/[0.05]">
        <FolderOpen className="size-4 shrink-0 text-gold" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-zinc-200" title={project.name}>
          {project.name}
        </span>
        <span className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-1 font-mono text-[9px] text-zinc-400">
          v{project.version}
        </span>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            aria-label="Rename app"
            title="Rename"
            disabled={generating}
            onClick={onRename}
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-white/[0.08] hover:text-foreground disabled:opacity-40"
          >
            <Pencil className="size-3" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="App actions"
                className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {project.published_slug ? (
                <DropdownMenuItem asChild>
                  <a
                    href={`/p/${project.published_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe />
                    View live app
                  </a>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled={generating || publishing} onClick={onPublish}>
                  <Rocket />
                  {publishing ? "Publishing…" : "Publish app"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={!project.html} onClick={onDownload}>
                <Download />
                Download HTML
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onRename}>
                <Pencil />
                Rename
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ------------------------------ editor files ------------------------------ */}
      <Section title="Open editors">
        <ul role="tree" aria-label="Editor files">
          {files.map((f) => {
            const active = activeTab === f.id;
            return (
              <li key={f.id} role="treeitem" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => onOpenTab(f.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "row relative mx-2 my-px flex h-7 w-[calc(100%-1rem)] items-center gap-1.5 rounded-md px-1.5 pl-2 text-left transition-colors",
                    active
                      ? "bg-white/[0.07] text-foreground"
                      : "text-zinc-400 hover:bg-white/[0.05] hover:text-foreground"
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-gold"
                    />
                  ) : null}
                  <f.icon
                    className={cn(
                      "size-3.5 shrink-0",
                      active ? "text-gold" : "text-zinc-500"
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate text-[12.5px]">{f.label}</span>
                  {f.id === "diff" && project.versions.length < 2 ? (
                    <span className="ml-auto shrink-0 font-mono text-[9px] text-zinc-600">
                      soon
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ----------------------------- version history ----------------------------- */}
      <Section title="Version history">
        {versions.length === 0 ? (
          <p className="px-4 py-1.5 text-[11px] text-zinc-600">
            Versions appear after each build.
          </p>
        ) : (
          <ul aria-label="Version history">
            {versions.map((v, idx) => {
              const current = v.version === project.version;
              const comparing = diffTo === v.version;
              return (
                <li key={v.id} className="group/v relative">
                  <button
                    type="button"
                    onClick={() => {
                      /* Compare against the previous version; the oldest
                         falls back to the next newer one so a diff always
                         has two distinct sides. */
                      if (idx + 1 < versions.length) {
                        onOpenDiff(versions[idx + 1].version, v.version);
                      } else if (idx > 0) {
                        onOpenDiff(v.version, versions[idx - 1].version);
                      }
                    }}
                    title={`Compare v${v.version} with the adjacent version`}
                    className={cn(
                      "row mx-2 my-px flex h-7 w-[calc(100%-1rem)] items-center gap-1.5 rounded-md pl-1.5 pr-1 text-left transition-colors",
                      comparing
                        ? "bg-white/[0.07] text-foreground"
                        : "text-zinc-400 hover:bg-white/[0.05] hover:text-foreground"
                    )}
                  >
                    <History
                      className={cn(
                        "size-3.5 shrink-0",
                        current ? "text-gold" : "text-zinc-500"
                      )}
                      aria-hidden="true"
                    />
                    <span className="shrink-0 font-mono text-[10.5px]">
                      v{v.version}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-500">
                      {displayContent(v.label).slice(0, 30) || "build"}
                    </span>
                    {current ? (
                      <Check className="size-3 shrink-0 text-gold" aria-hidden="true" />
                    ) : null}
                  </button>
                  {/* hover restore */}
                  {!current && !generating ? (
                    <button
                      type="button"
                      aria-label={`Restore version ${v.version}`}
                      title={`Restore v${v.version}`}
                      disabled={restoringVersion !== null}
                      onClick={() => onRestore(v.version)}
                      className="absolute right-3 top-1/2 hidden size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-white/[0.08] hover:text-foreground disabled:opacity-40 group-hover/v:inline-flex"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* -------------------------------- app meta -------------------------------- */}
      <div className="mt-auto space-y-1 px-4 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">
        <p>
          status:{" "}
          <span
            className={cn(
              generating ? "text-gold" : project.status === "error" ? "text-rose-300" : "text-zinc-400"
            )}
          >
            {generating ? "building" : project.status}
          </span>
        </p>
        <p>{project.messages.length} messages</p>
        <p>created {relative(project.created_at) || "recently"}</p>
      </div>

      {/* last exchange preview */}
      {lastMsg ? (
        <p className="mt-2 line-clamp-2 px-4 text-[11px] normal-case leading-snug text-zinc-600" title={displayContent(lastMsg.content)}>
          <span className="text-zinc-500">{lastMsg.role === "user" ? "you: " : "z.ai: "}</span>
          {displayContent(lastMsg.content)}
        </p>
      ) : null}
    </div>
  );
}

/** Collapsible explorer section with VS Code chevron. */
function Section({
  title,
  open = true,
  children,
}: {
  title: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <section className="mb-1">
      <div className="flex h-7 items-center px-2">
        <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {title}
        </span>
      </div>
      <div className="pb-1">{children}</div>
    </section>
  );
}
