"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  ExternalLink,
  GitFork,
  Globe,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow, isValid } from "date-fns";
import { toast } from "sonner";

import { ScaledThumb } from "@/components/scaled-thumb";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ApiError, deleteProject, duplicateProject, forkProject, renameProject, unpublishProject } from "@/lib/api";
import type { ProjectStatus, ProjectSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ProjectCardData = ProjectSummary & { html?: string | null };

function StatusBadge({ status }: { status: ProjectStatus }) {
  if (status === "generating") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-gold">
        <span className="size-1.5 animate-pulse rounded-full bg-gold" />
        Generating
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-rose-300">
        <span className="size-1.5 rounded-full bg-rose-400" />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-gold">
      <span className="size-1.5 rounded-full bg-gold" />
      Ready
    </span>
  );
}

export function ProjectCard({
  project,
  onDeleted,
  onRenamed,
  onDuplicated,
  onUnpublished,
}: {
  project: ProjectCardData;
  onDeleted: (id: string) => void;
  onRenamed: (id: string, name: string) => void;
  onDuplicated?: (p: { id: string; name: string }) => void;
  onUnpublished?: (id: string) => void;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [renaming, setRenaming] = useState(false);
  const [forking, setForking] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  const updatedAt = project.updated_at ? new Date(project.updated_at) : null;
  const updatedLabel =
    updatedAt && isValid(updatedAt)
      ? formatDistanceToNow(updatedAt, { addSuffix: true })
      : "just now";

  function open() {
    router.push(`/builder/${project.id}`);
  }

  async function copyPublishLink() {
    if (!project.published_slug) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/p/${project.published_slug}`
      );
      toast.success("Publish link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  async function handleRename() {
    const name = renameValue.trim();
    if (!name || renaming) return;
    setRenaming(true);
    try {
      await renameProject(project.id, name);
      onRenamed(project.id, name);
      toast.success("Renamed");
      setRenameOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Rename failed");
    } finally {
      setRenaming(false);
    }
  }

  async function handleFork() {
    if (forking) return;
    setForking(true);
    try {
      const fork = await forkProject(project.id);
      toast.success(`Forked as "${fork.name}"`);
      router.push(`/builder/${fork.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Fork failed");
      setForking(false);
    }
  }

  async function handleDuplicate() {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const res = await duplicateProject(project.id);
      toast.success(`Duplicated as “${res.name}”`);
      onDuplicated?.(res);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Duplicate failed. Please try again."
      );
    } finally {
      setDuplicating(false);
    }
  }

  async function handleUnpublish() {
    if (unpublishing) return;
    setUnpublishing(true);
    try {
      await unpublishProject(project.id);
      toast.success("App is offline");
      onUnpublished?.(project.id);
      setUnpublishOpen(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Unpublish failed. Please try again."
      );
    } finally {
      setUnpublishing(false);
    }
  }

  function handleDownload() {
    if (!project.html) {
      toast.error("The app has no build yet");
      return;
    }
    try {
      const blob = new Blob([project.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "app"}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("App downloaded as HTML");
    } catch {
      toast.error("Download failed");
    }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      toast.success(`Deleted "${project.name}"`);
      onDeleted(project.id);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Delete failed. Please try again."
      );
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        role="link"
        tabIndex={0}
        aria-label={`Open ${project.name} in the builder`}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className="group luxe-card cursor-pointer overflow-hidden rounded-xl transition-colors duration-300 hover:border-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Live preview window */}
        <div className="relative aspect-video overflow-hidden bg-zinc-950">
          {project.html ? (
            <>
              <ScaledThumb
                html={project.html}
                title={`${project.name} preview`}
                className="absolute inset-0 h-full w-full"
              />
              <div className="pointer-events-none absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </>
          ) : (
            <div className="absolute inset-0 bg-white/[0.02]" />
          )}

          {project.published_slug ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-neutral-950/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-gold backdrop-blur">
              <Globe className="size-3" />
              Live
            </span>
          ) : null}
          <div className="absolute right-3 top-3">
            <StatusBadge status={project.status} />
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[15px] font-semibold">
              {project.name}
            </h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground"
                  aria-label={`Actions for ${project.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onClick={open}>
                  <ExternalLink />
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setRenameValue(project.name);
                    setRenameOpen(true);
                  }}
                >
                  <Pencil />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleFork()} disabled={forking}>
                  {forking ? <Loader2 className="animate-spin" /> : <GitFork />}
                  Fork
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleDuplicate()} disabled={duplicating}>
                  {duplicating ? <Loader2 className="animate-spin" /> : <Copy />}
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload} disabled={!project.html}>
                  <Download />
                  Download HTML
                </DropdownMenuItem>
                {project.published_slug ? (
                  <DropdownMenuItem onClick={copyPublishLink}>
                    <Copy />
                    Copy publish link
                  </DropdownMenuItem>
                ) : null}
                {project.published_slug ? (
                  <DropdownMenuItem
                    onClick={() => setUnpublishOpen(true)}
                    disabled={unpublishing}
                  >
                    <Globe />
                    Unpublish
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
            {project.description || "No description yet"}
          </p>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0">v{project.version}</span>
            <Separator orientation="vertical" className="h-3" />
            <span className="truncate">updated {updatedLabel}</span>
          </div>
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Rename app</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename();
            }}
            aria-label="App name"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)} disabled={renaming}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleRename()}
              disabled={renaming || !renameValue.trim()}
            >
              {renaming ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{project.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the app, all of its versions and its
              published link. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className={cn(
                "bg-destructive text-white hover:bg-destructive/90"
              )}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unpublish confirmation */}
      <AlertDialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Take “{project.name}” offline?</AlertDialogTitle>
            <AlertDialogDescription>
              The public link to this app stops working immediately. You can
              publish it again at any time from the builder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unpublishing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={unpublishing}
              onClick={(e) => {
                e.preventDefault();
                void handleUnpublish();
              }}
            >
              {unpublishing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Globe className="size-4" />
              )}
              Unpublish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
