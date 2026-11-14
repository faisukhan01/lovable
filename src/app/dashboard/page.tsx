"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CommandPalette } from "@/components/dashboard/command-palette";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { ExplorerSidebar } from "@/components/ide/explorer-sidebar";
import { IdeShell, IdeShellSkeleton } from "@/components/ide/ide-shell";
import { WelcomeEditor } from "@/components/ide/welcome-editor";
import { ApiError, createProject, listProjects } from "@/lib/api";
import { popPendingPrompt, useAuthStore } from "@/lib/store";
import type { ProjectSummary } from "@/lib/types";

/**
 * The Lovify workspace — a VS Code / Cursor style IDE view.
 * Title bar + activity bar + explorer side bar + Welcome editor tab,
 * with the Z.AI prompt composer front and center.
 */
export default function DashboardPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [dialogPrompt, setDialogPrompt] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [building, setBuilding] = useState(false);

  /* Auth guard */
  useEffect(() => {
    if (hasHydrated && !token) router.replace("/auth");
  }, [hasHydrated, token, router]);

  /* Global ⌘/Ctrl + K toggles the command palette. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProjects(true);
      setProjects(res.projects);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load your projects. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasHydrated && token) {
      void load();
      /* A prompt stashed before auth (landing page or chat) opens the
         composer dialog pre-filled — the idea is never lost. */
      const pending = popPendingPrompt();
      if (pending) {
        setDialogPrompt(pending);
        setCreateOpen(true);
      }
    }
  }, [hasHydrated, token, load]);

  /* Keep the tree live while one of the apps is generating. */
  useEffect(() => {
    if (hasHydrated && token && projects.some((p) => p.status === "generating")) {
      const t = setInterval(() => void load(), 4000);
      return () => clearInterval(t);
    }
  }, [hasHydrated, token, projects, load]);

  function openNewProject(seed?: string | null) {
    setDialogPrompt(seed ?? null);
    setCreateOpen(true);
  }

  /* Direct build from the Welcome composer (Cursor style). */
  async function handleBuild(prompt: string) {
    if (building) return;
    setBuilding(true);
    try {
      const project = await createProject(prompt);
      toast.success("Project created — Lovify is building it");
      router.push(`/builder/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/auth");
        return;
      }
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not create the project. Please try again."
      );
    } finally {
      setBuilding(false);
    }
  }

  /* Loader while hydrating or redirecting to /auth — keeps the IDE frame
     up so the Cursor chrome never flashes away mid-navigation. */
  if (!hasHydrated || !token) {
    return <IdeShellSkeleton hint="Opening workspace…" />;
  }

  const liveCount = projects.filter((p) => p.published_slug).length;
  const displayName = user?.name || user?.email?.split("@")[0] || "builder";

  return (
    <>
      <IdeShell
        onOpenPalette={() => setPaletteOpen(true)}
        onNewProject={() => openNewProject()}
        sidebar={
          <ExplorerSidebar
            projects={projects}
            loading={loading}
            onNewProject={() => openNewProject()}
            onNewFromTemplate={(prompt) => openNewProject(prompt)}
            onChanged={() => void load()}
          />
        }
        tabs={
          <>
            {/* active editor tab — VS Code style with gold top edge */}
            <div
              aria-current="page"
              className="flex items-center gap-1.5 border-r border-white/[0.06] border-t-2 border-t-gold bg-background px-3.5"
            >
              <Sparkles className="size-3.5 text-gold" aria-hidden="true" />
              <span className="text-xs text-foreground">Welcome</span>
              <button
                type="button"
                aria-label="Close tab (not really — this is home)"
                title="Home tab"
                className="ml-1 inline-flex size-4 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-white/[0.08] hover:opacity-100"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </div>
          </>
        }
        breadcrumb={
          <span aria-hidden="true">
            lovify <span className="text-zinc-700">/</span> workspace{" "}
            <span className="text-zinc-700">/</span>{" "}
            <span className="text-zinc-500">welcome.md</span>
          </span>
        }
        statusLeft={
          <>
            <span className="hidden items-center gap-1.5 px-2.5 sm:flex">
              workspace:
              <span className="text-zinc-200">{displayName}</span>
            </span>
            {error ? (
              <span className="px-2.5 text-rose-300">tree load failed</span>
            ) : null}
          </>
        }
        statusRight={
          <>
            <span className="px-2.5">
              {loading ? "…" : `${projects.length} apps · ${liveCount} live`}
            </span>
            <span className="hidden items-center gap-1.5 px-2.5 sm:flex">
              <span className="size-1.5 animate-pulse rounded-full bg-gold" aria-hidden="true" />
              Z.AI connected
            </span>
          </>
        }
      >
        {error ? (
          <div className="mx-auto mt-10 max-w-md rounded-xl border border-rose-400/30 bg-rose-500/10 p-5 text-sm text-rose-100">
            {error} — check your connection and{" "}
            <button
              type="button"
              onClick={() => void load()}
              className="underline underline-offset-2"
            >
              retry
            </button>
            .
          </div>
        ) : (
          <WelcomeEditor
            projects={projects}
            loading={loading}
            creating={building}
            onNewProject={() => openNewProject()}
            onOpen={(id) => router.push(`/builder/${id}`)}
            onBuild={(prompt) => void handleBuild(prompt)}
          />
        )}
      </IdeShell>

      <CreateProjectDialog
        /* Keyed by the seed so every template / stashed prompt starts a
           fresh draft (the dialog resets on close otherwise). */
        key={dialogPrompt ?? "blank"}
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            /* keep the seeded value until the dialog has reset itself */
            setTimeout(() => setDialogPrompt(null), 200);
          }
        }}
        initialPrompt={dialogPrompt}
      />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        projects={projects.map((p) => ({ id: p.id, name: p.name, status: p.status }))}
        onNewProject={() => openNewProject()}
      />
    </>
  );
}
