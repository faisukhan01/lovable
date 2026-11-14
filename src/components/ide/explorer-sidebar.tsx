"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Check,
  ChevronRight,
  Copy,
  FileCode2,
  Gamepad2,
  Globe,
  ListTodo,
  MoreHorizontal,
  NotebookPen,
  Palette,
  Pencil,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow, isValid } from "date-fns";
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
import { ApiError, deleteProject, duplicateProject, renameProject } from "@/lib/api";
import { EXAMPLE_PROMPTS } from "@/lib/examples";
import type { ProjectStatus, ProjectSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  todo: ListTodo,
  portfolio: Palette,
  crm: BarChart3,
  game: Gamepad2,
  store: ShoppingBag,
  blog: NotebookPen,
};

function statusMeta(status: ProjectStatus) {
  if (status === "generating")
    return { dot: "bg-gold animate-pulse", icon: "text-gold" };
  if (status === "error") return { dot: "bg-rose-400", icon: "text-rose-300" };
  return { dot: "bg-zinc-500", icon: "text-gold/80" };
}

/**
 * VS Code explorer side bar for Lovify — projects as a file tree,
 * quick-start templates, workspace stats. Handles open / rename /
 * duplicate / delete inline, exactly like the real explorer.
 */
export function ExplorerSidebar({
  projects,
  loading,
  onNewProject,
  onNewFromTemplate,
  onOpen,
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
}) {
  const router = useRouter();
  const [openProjects, setOpenProjects] = useState(true);
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
    <div className="flex min-h-0 flex-1 flex-col pb-4 text-[13px]">
      {/* section caption */}
      <div className="flex h-8 shrink-0 items-center justify-between px-4">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          Explorer
        </span>
      </div>

      {/* ------------------------------ projects ------------------------------ */}
      <Section
        title="Projects"
        count={projects.length}
        open={openProjects}
        onToggle={() => setOpenProjects((v) => !v)}
        action={
          <button
            type="button"
            aria-label="New project"
            title="New project"
            onClick={onNewProject}
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </button>
        }
      >
        {loading ? (
          <div className="space-y-1 px-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full bg-white/[0.05]" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <button
            type="button"
            onClick={onNewProject}
            className="mx-2 flex items-center gap-2 rounded-md border border-dashed border-white/[0.12] px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
          >
            <Sparkles className="size-3.5 shrink-0 text-gold" aria-hidden="true" />
            <span>
              No apps yet.
              <span className="block text-[11px] text-zinc-500">
                Describe one to get started
              </span>
            </span>
          </button>
        ) : (
          <ul role="tree" aria-label="Your apps">
            {projects.map((p) => {
              const meta = statusMeta(p.status);
              const busy = busyId === p.id;
              return (
                <li key={p.id} role="treeitem" aria-selected={false}>
                  {renamingId === p.id ? (
                    /* inline rename — VS Code F2 style */
                    <div className="mx-2 my-px flex items-center gap-1.5 rounded-md bg-white/[0.06] px-1.5 py-0.5">
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
                        className="h-5 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none"
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
                    <div
                      className={cn(
                        "group row mx-2 my-px flex h-7 items-center gap-1.5 rounded-md pl-1.5 pr-1 transition-colors",
                        busy ? "opacity-50" : "hover:bg-white/[0.05]"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => open(p.id)}
                        className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        title={p.description || p.name}
                      >
                        <FileCode2 className={cn("size-3.5 shrink-0", meta.icon)} aria-hidden="true" />
                        <span className="truncate text-[12.5px] text-zinc-300 group-hover:text-foreground">
                          {p.name}
                        </span>
                        {p.status === "generating" ? (
                          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
                            building
                          </span>
                        ) : null}
                      </button>

                      {/* hover actions */}
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        {p.published_slug ? (
                          <a
                            href={`/p/${p.published_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View ${p.name} live`}
                            title="View live"
                            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-gold"
                          >
                            <Globe className="size-3.5" />
                          </a>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Actions for ${p.name}`}
                              className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
                            >
                              <MoreHorizontal className="size-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            <DropdownMenuItem onClick={() => open(p.id)}>
                              <FileCode2 />
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setRenameValue(p.name);
                                setRenamingId(p.id);
                              }}
                            >
                              <Pencil />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleDuplicate(p.id)}>
                              <Copy />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-rose-300 focus:text-rose-200"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* ----------------------------- templates ----------------------------- */}
      <Section
        title="Start from a template"
        open={openTemplates}
        onToggle={() => setOpenTemplates((v) => !v)}
      >
        {EXAMPLE_PROMPTS.map((ex) => {
          const Icon = TEMPLATE_ICONS[ex.icon] ?? Sparkles;
          return (
            <button
              key={ex.icon}
              type="button"
              onClick={() =>
                onNewFromTemplate ? onNewFromTemplate(ex.prompt) : onNewProject()
              }
              title={ex.prompt}
              className="row mx-2 my-px flex h-7 w-[calc(100%-1rem)] items-center gap-1.5 rounded-md px-1.5 text-left transition-colors hover:bg-white/[0.05]"
            >
              <Icon className="size-3.5 shrink-0 text-gold/80" aria-hidden="true" />
              <span className="truncate text-[12.5px] text-zinc-400 hover:text-foreground">
                {ex.title}
              </span>
            </button>
          );
        })}
      </Section>

      {/* ------------------------------- stats ------------------------------- */}
      <div className="mt-auto px-4 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">
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

/** Collapsible explorer section with VS Code chevron + hover action. */
function Section({
  title,
  count,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-1">
      <div className="group flex h-7 items-center gap-0.5 pr-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex h-full min-w-0 flex-1 items-center gap-1 px-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 text-zinc-500 transition-transform duration-150",
              open && "rotate-90"
            )}
          />
          <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            {title}
            {count !== undefined ? (
              <span className="ml-1.5 text-zinc-600">{count}</span>
            ) : null}
          </span>
        </button>
        {action ? (
          <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {action}
          </span>
        ) : null}
      </div>
      {open ? <div className="pb-1">{children}</div> : null}
    </section>
  );
}
