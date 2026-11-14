"use client";

/**
 * The dashboard Explorer — VS Code tree with the LOVIFY workspace root,
 * your apps as files (status dot on the row, hover actions), a templates
 * folder and import entries in the view header.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode2,
  FolderOpen,
  FolderUp,
  Globe,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewHeader, ViewRow } from "@/components/ide/views";
import { ApiError, deleteProject, duplicateProject, renameProject } from "@/lib/api";
import { EXAMPLE_PROMPTS } from "@/lib/examples";
import type { ProjectStatus, ProjectSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  todo: FileCode2,
  portfolio: Sparkles,
  crm: FileCode2,
  game: Sparkles,
  store: FileCode2,
  blog: Sparkles,
};

function statusMeta(status: ProjectStatus) {
  if (status === "generating")
    return { dot: "bg-gold animate-pulse", icon: "text-gold" };
  if (status === "error") return { dot: "bg-rose-400", icon: "text-rose-300" };
  return { dot: "bg-zinc-500", icon: "text-gold/80" };
}

export function ExplorerSidebar({
  projects,
  loading,
  onNewProject,
  onNewFromTemplate,
  onOpen,
  onChanged,
  onImportFolder,
  onImportFiles,
}: {
  projects: ProjectSummary[];
  loading: boolean;
  onNewProject: () => void;
  /** Opens the composer pre-filled with a template prompt. */
  onNewFromTemplate?: (prompt: string) => void;
  /** Called when a project row should open (defaults to /builder/:id). */
  onOpen?: (id: string) => void;
  /** Called after any mutation (rename / duplicate / delete). */
  onChanged?: () => void;
  onImportFolder?: () => void;
  onImportFiles?: () => void;
}) {
  const router = useRouter();
  const [rootOpen, setRootOpen] = useState(true);
  const [openTemplates, setOpenTemplates] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);

  function open(id: string) {
    if (onOpen) return onOpen(id);
    router.push(`/builder/${id}`);
  }

  async function handleRename(id: string, name: string) {
    const next = name.trim();
    setRenamingId(null);
    if (!next) return;
    setBusyId(id);
    try {
      await renameProject(id, next);
      toast.success("Renamed");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Rename failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDuplicate(id: string) {
    setBusyId(id);
    try {
      await duplicateProject(id);
      toast.success("Duplicated");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Duplicate failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteProject(id);
      toast.success("Moved to trash");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  const liveCount = projects.filter((p) => p.published_slug).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-3">
      <ViewHeader
        title="Explorer"
        actions={
          <>
            {onImportFolder ? (
              <button
                type="button"
                aria-label="Import folder"
                title="Import folder…"
                onClick={onImportFolder}
                className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
              >
                <FolderUp className="size-4" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label="New project"
              title="New project…"
              onClick={onNewProject}
              className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </>
        }
      />

      {/* workspace root */}
      <button
        type="button"
        onClick={() => setRootOpen((v) => !v)}
        aria-expanded={rootOpen}
        className="flex h-[22px] w-full items-center gap-1 pl-2 pr-3 text-left text-[13px] font-semibold text-zinc-200 outline-none transition-colors hover:bg-white/[0.04]"
      >
        {rootOpen ? (
          <ChevronDown className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
        )}
        <FolderOpen className="size-4 shrink-0 text-gold" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">lovify-workspace</span>
      </button>

      {/* projects as files */}
      {rootOpen ? (
        <div role="tree" aria-label="Your apps" className="mt-px">
          {loading ? (
            <div className="space-y-1 px-3 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full bg-white/[0.05]" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <ViewRow indent={1} onClick={onNewProject}>
              <Sparkles className="size-3.5 shrink-0 text-gold" aria-hidden="true" />
              <span className="truncate text-zinc-300">No apps yet — create one…</span>
            </ViewRow>
          ) : (
            projects.map((p) => {
              const meta = statusMeta(p.status);
              const busy = busyId === p.id;
              return (
                <div key={p.id} className={cn("group relative", busy && "opacity-50")}>
                  {renamingId === p.id ? (
                    /* inline rename — VS Code F2 style */
                    <div
                      className="flex h-[22px] items-center gap-1.5 bg-white/[0.07] pl-6 pr-2"
                      style={{ paddingLeft: 10 + 1 * 12 }}
                    >
                      <FileCode2 className={cn("size-3.5 shrink-0", meta.icon)} aria-hidden="true" />
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => setRenamingId(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(p.id, renameValue);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        aria-label="App name"
                        className="h-5 min-w-0 flex-1 bg-transparent text-[12.5px] text-zinc-100 outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Confirm rename"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void handleRename(p.id, renameValue)}
                        className="text-gold"
                      >
                        <Check className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="group/row relative">
                      <ViewRow indent={1} title={p.description || p.name} onClick={() => open(p.id)}>
                        <FileCode2 className={cn("size-3.5 shrink-0", meta.icon)} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {p.status === "generating" ? (
                          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-gold">
                            building
                          </span>
                        ) : p.published_slug ? (
                          <Globe
                            className="size-3 shrink-0 text-emerald-400/70"
                            aria-hidden="true"
                          />
                        ) : null}
                      </ViewRow>
                      {/* hover actions */}
                      <div className="absolute right-1.5 top-0 flex h-[22px] items-center gap-0.5 bg-gradient-to-l from-[#181818] via-[#181818] to-transparent pl-4 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Actions for ${p.name}`}
                              className="inline-flex size-5 items-center justify-center rounded text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100"
                            >
                              <MoreHorizontal className="size-3.5" aria-hidden="true" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-44 border-[#454545] bg-[#1f1f1f] text-zinc-200"
                          >
                            <DropdownMenuItem
                              onSelect={() => open(p.id)}
                              className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
                            >
                              <FileCode2 className="size-3.5" /> Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setRenameValue(p.name);
                                setRenamingId(p.id);
                              }}
                              className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
                            >
                              <Pencil className="size-3.5" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => void handleDuplicate(p.id)}
                              className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
                            >
                              <Copy className="size-3.5" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/[0.08]" />
                            <DropdownMenuItem
                              onSelect={() => setDeleteTarget(p)}
                              className="gap-2 text-[12.5px] text-rose-300 focus:text-rose-200 data-[highlighted]:bg-white/[0.08]"
                            >
                              <Trash2 className="size-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {/* templates */}
      <button
        type="button"
        onClick={() => setOpenTemplates((v) => !v)}
        aria-expanded={openTemplates}
        className="mt-1.5 flex h-[22px] w-full items-center gap-1 pl-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500 outline-none transition-colors hover:text-zinc-300"
      >
        {openTemplates ? (
          <ChevronDown className="size-3.5 text-zinc-500" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-3.5 text-zinc-500" aria-hidden="true" />
        )}
        Start from a template
      </button>
      {openTemplates ? (
        <div role="list" aria-label="Templates">
          {EXAMPLE_PROMPTS.map((ex) => {
            const Icon = TEMPLATE_ICONS[ex.icon] ?? Sparkles;
            return (
              <ViewRow
                key={ex.icon}
                indent={1}
                title={ex.prompt}
                onClick={() =>
                  onNewFromTemplate ? onNewFromTemplate(ex.prompt) : onNewProject()
                }
              >
                <Icon className="size-3.5 shrink-0 text-gold/80" aria-hidden="true" />
                <span className="truncate">{ex.title}</span>
              </ViewRow>
            );
          })}
        </div>
      ) : null}

      {/* stats */}
      <div className="mt-auto px-4 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">
        {projects.length} app{projects.length === 1 ? "" : "s"} · {liveCount} live
      </div>

      {/* delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => (v ? null : setDeleteTarget(null))}
      >
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl tracking-normal">
              Delete “{deleteTarget?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the app and its version history. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && void handleDelete(deleteTarget.id)}
              className="bg-rose-500/90 text-white hover:bg-rose-500"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
