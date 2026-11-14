"use client";

/**
 * The builder Explorer — a real VS Code tree: project root with chevron,
 * the generated files (index.html / styles.css / app.js / README.md),
 * then Outline and Timeline sections at the bottom like the real IDE.
 */

import { useState } from "react";
import { formatDistanceToNow, isValid } from "date-fns";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  FolderOpen,
  Globe,
  History,
  ListTree,
  MoreHorizontal,
  Pencil,
  Rocket,
  RotateCcw,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ViewHeader, ViewRow } from "@/components/ide/views";
import { FileIcon } from "@/components/ide/editor-chrome";
import { displayContent } from "@/components/builder/chat-panel";
import type { VFile } from "@/lib/project-files";
import type { ProjectDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BuilderExplorerTab = "preview" | "code" | "diff";

function relative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : "";
}

export function BuilderExplorer({
  project,
  files,
  activeTab,
  activeFile,
  diffTo,
  restoringVersion,
  generating,
  publishing,
  onOpenTab,
  onOpenFile,
  onOpenDiff,
  onRestore,
  onRename,
  onPublish,
  onDownload,
}: {
  project: ProjectDetail;
  files: VFile[];
  activeTab: BuilderExplorerTab;
  /** Which generated file is open in the editor ("" when preview/diff). */
  activeFile: string;
  diffTo: number | null;
  restoringVersion: number | null;
  generating: boolean;
  publishing: boolean;
  onOpenTab: (tab: BuilderExplorerTab) => void;
  onOpenFile: (path: string) => void;
  onOpenDiff: (from: number | null, to: number) => void;
  onRestore: (version: number) => void;
  onRename: () => void;
  onPublish: () => void;
  onDownload: () => void;
}) {
  const [rootOpen, setRootOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(true);

  const versions = [...project.versions].sort((a, b) => b.version - a.version);

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-3">
      <ViewHeader
        title="Explorer"
        actions={
          <button
            type="button"
            aria-label="More explorer actions"
            title="More actions"
            onClick={onRename}
            className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
        }
      />

      {/* project root row */}
      <button
        type="button"
        onClick={() => setRootOpen((v) => !v)}
        aria-expanded={rootOpen}
        className="group flex h-[22px] w-full items-center gap-1 pl-2 pr-3 text-left text-[13px] font-semibold text-zinc-200 outline-none transition-colors hover:bg-white/[0.04]"
      >
        {rootOpen ? (
          <ChevronDown className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
        )}
        <FolderOpen className="size-4 shrink-0 text-gold" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate" title={project.name}>
          {project.name}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span
              role="button"
              tabIndex={0}
              aria-label="App actions"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="inline-flex size-5 items-center justify-center rounded text-zinc-400 opacity-0 transition-opacity hover:bg-white/[0.08] hover:text-zinc-100 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <MoreHorizontal className="size-3.5" aria-hidden="true" />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 border-[#454545] bg-[#1f1f1f] text-zinc-200">
            {project.published_slug ? (
              <DropdownMenuItem
                asChild
                className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
              >
                <a href={`/p/${project.published_slug}`} target="_blank" rel="noopener noreferrer">
                  <Globe className="size-3.5" /> View live app
                </a>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={generating || publishing}
                onSelect={onPublish}
                className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
              >
                <Rocket className="size-3.5" />
                {publishing ? "Publishing…" : "Publish app"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={!project.html}
              onSelect={onDownload}
              className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
            >
              <Download className="size-3.5" /> Download HTML
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.08]" />
            <DropdownMenuItem
              onSelect={onRename}
              className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
            >
              <Pencil className="size-3.5" /> Rename
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </button>

      {/* file tree */}
      {rootOpen ? (
        <div role="tree" aria-label="Workspace files" className="mt-px">
          {files.map((f) => {
            const active = activeTab === "code" && activeFile === f.path;
            return (
              <ViewRow
                key={f.path}
                indent={1}
                active={active}
                title={f.path}
                onClick={() => onOpenFile(f.path)}
              >
                <FileIcon lang={f.lang} />
                <span className="truncate">{f.label}</span>
                {f.path === "index.html" && project.html ? null : null}
              </ViewRow>
            );
          })}
          {/* preview + diff as editor surfaces, like VS Code's simple browser */}
          <ViewRow indent={1} active={activeTab === "preview"} onClick={() => onOpenTab("preview")}>
            <FileText className="size-3.5 shrink-0 text-[#29B8DB]" aria-hidden="true" />
            <span className="truncate">Live Preview</span>
          </ViewRow>
          <ViewRow
            indent={1}
            active={activeTab === "diff"}
            onClick={() => onOpenDiff(null, project.version)}
            title="versions.diff"
          >
            <FileIcon lang="diff" />
            <span className="truncate">versions.diff</span>
            {project.versions.length < 2 ? (
              <span className="ml-auto shrink-0 font-mono text-[9px] text-zinc-600">soon</span>
            ) : null}
          </ViewRow>
        </div>
      ) : null}

      {/* outline (decorative section like the real explorer) */}
      <button
        type="button"
        onClick={() => setRootOpen((v) => !v)}
        aria-expanded={rootOpen}
        className="mt-1 flex h-[22px] w-full items-center gap-1 pl-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500 outline-none transition-colors hover:text-zinc-300"
      >
        <ListTree className="size-3.5 text-zinc-500" aria-hidden="true" />
        Outline
      </button>

      {/* timeline = version history */}
      <button
        type="button"
        onClick={() => setTimelineOpen((v) => !v)}
        aria-expanded={timelineOpen}
        className="mt-1.5 flex h-[22px] w-full items-center gap-1 pl-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500 outline-none transition-colors hover:text-zinc-300"
      >
        {timelineOpen ? (
          <ChevronDown className="size-3.5 text-zinc-500" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-3.5 text-zinc-500" aria-hidden="true" />
        )}
        <History className="size-3.5 text-zinc-500" aria-hidden="true" />
        Timeline
      </button>
      {timelineOpen ? (
        <div role="list" aria-label="Version timeline">
          {versions.length === 0 ? (
            <p className="px-4 py-1.5 text-[11px] text-zinc-600">
              Versions appear after each build.
            </p>
          ) : (
            versions.map((v, idx) => {
              const current = v.version === project.version;
              return (
                <div key={v.id} className="group/v relative">
                  <ViewRow
                    indent={1}
                    title={`Compare v${v.version} with the adjacent version`}
                    onClick={() => {
                      if (idx + 1 < versions.length) onOpenDiff(versions[idx + 1].version, v.version);
                      else if (idx > 0) onOpenDiff(v.version, versions[idx - 1].version);
                    }}
                  >
                    <span className="shrink-0 font-mono text-[10.5px] text-zinc-500">
                      v{v.version}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-500">
                      {displayContent(v.label).slice(0, 24) || "build"}
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
      ) : null}

      {/* workspace meta footer */}
      <div className="mt-auto space-y-0.5 px-4 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">
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
        <p>{project.messages.length} messages · {relative(project.updated_at || project.created_at)}</p>
      </div>
    </div>
  );
}
