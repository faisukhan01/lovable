"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { CommandPalette } from "@/components/dashboard/command-palette";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { ChatDock } from "@/components/ide/chat-dock";
import { ExplorerSidebar } from "@/components/ide/explorer-sidebar";
import { IdeShell, IdeShellSkeleton } from "@/components/ide/ide-shell";
import { IdeTab } from "@/components/ide/editor-chrome";
import { useImporters } from "@/components/ide/import-controls";
import {
  DebugView,
  ExtensionsView,
  ProjectSearchView,
} from "@/components/ide/views";
import { OutputView, TerminalView, type PanelTab } from "@/components/ide/panel-bottom";
import {
  Bell,
  Encoding,
  LnCol,
  StatusSegment,
} from "@/components/ide/status-bar";
import { WelcomeEditor } from "@/components/ide/welcome-editor";
import {
  ApiError,
  assistantChat,
  createProject,
  listProjects,
} from "@/lib/api";
import { popPendingPrompt, useAuthStore } from "@/lib/store";
import type { ChatMessage, ProjectSummary } from "@/lib/types";

/**
 * The Lovify workspace — a VS Code / Cursor IDE view.
 * Title menu bar + activity bar + explorer + Welcome editor tab + panel,
 * with the Cursor-style AI chat docked on the right.
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

  /* IDE chrome */
  const [chatOpen, setChatOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<PanelTab>("terminal");
  const importers = useImporters();

  /* Workspace chat (assistant, not project-bound) */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSending, setChatSending] = useState(false);
  const [chatMode, setChatMode] = useState<"build" | "ask">("ask");
  const chatBusyRef = useRef(false);

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
      toast.success("Project created — opening the workspace");
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

  async function handleChatSend(text: string): Promise<boolean> {
    if (chatBusyRef.current) return false;
    const history: ChatMessage[] = [...chatMessages, { role: "user", content: text }];
    setChatMessages(history);
    setChatSending(true);
    chatBusyRef.current = true;
    try {
      const res = await assistantChat(history.slice(-12));
      setChatMessages([...history, { role: "assistant", content: res.reply }]);
      return true;
    } catch {
      setChatMessages(history.slice(0, -1));
      toast.error("The assistant is busy. Please try again.");
      return false;
    } finally {
      setChatSending(false);
      chatBusyRef.current = false;
    }
  }

  /* Loader while hydrating or redirecting to /auth — keeps the IDE frame
     up so the Cursor chrome never flashes away mid-navigation. */
  if (!hasHydrated || !token) {
    return <IdeShellSkeleton hint="Opening workspace…" />;
  }

  const liveCount = projects.filter((p) => p.published_slug).length;
  const displayName = user?.name || user?.email?.split("@")[0] || "builder";
  const generatingCount = projects.filter((p) => p.status === "generating").length;

  const menu = {
    onNewProject: () => openNewProject(),
    onImportFolder: importers.openFolder,
    onImportFiles: importers.openFiles,
  };

  const panel = {
    tabs: ["problems", "output", "terminal"] as PanelTab[],
    active: panelTab,
    onActive: setPanelTab,
    content:
      panelTab === "problems" ? (
        <div className="flex h-full items-center justify-center px-4 text-xs text-zinc-500">
          No problems have been detected in the workspace.
        </div>
      ) : panelTab === "output" ? (
        <OutputView
          lines={[
            { kind: "info", text: `[workspace] signed in as ${user?.email ?? "builder"}` },
            {
              kind: loading ? "warn" : "ok",
              text: loading
                ? "[workspace] loading your apps…"
                : `[workspace] ${projects.length} apps loaded · ${liveCount} live · ${generatingCount} building`,
            },
            ...(error ? [{ kind: "error" as const, text: `[workspace] ${error}` }] : []),
          ]}
        />
      ) : (
        <TerminalView
          intro={["Type 'help' for commands, 'ls' to list your apps."]}
          files={projects.map((p) => p.name)}
          statusLine={`${projects.length} apps · ${liveCount} live · Z.AI connected`}
        />
      ),
  };

  return (
    <>
      <IdeShell
        title="lovify — workspace"
        menu={menu}
        actions={importers.inputs}
        badges={generatingCount > 0 ? { explorer: generatingCount } : undefined}
        views={{
          explorer: (
            <ExplorerSidebar
              projects={projects}
              loading={loading}
              onNewProject={() => openNewProject()}
              onNewFromTemplate={(prompt) => openNewProject(prompt)}
              onChanged={() => void load()}
              onOpen={(id) => router.push(`/builder/${id}`)}
              onImportFolder={importers.openFolder}
              onImportFiles={importers.openFiles}
            />
          ),
          search: (
            <ProjectSearchView
              projects={projects}
              onOpen={(id) => router.push(`/builder/${id}`)}
              onNewProject={() => openNewProject()}
            />
          ),
          debug: <DebugView />,
          extensions: <ExtensionsView />,
        }}
        tabs={
          <IdeTab
            active
            onClick={() => undefined}
            icon={<Sparkles className="size-3.5 text-gold" aria-hidden="true" />}
            label="Welcome"
            hint="Home tab"
          />
        }
        breadcrumb={
          <span className="hidden items-center px-4 text-[11.5px] text-zinc-500 lg:flex" aria-hidden="true">
            lovify <span className="px-1 text-zinc-700">›</span> workspace{" "}
            <span className="px-1 text-zinc-700">›</span> welcome.md
          </span>
        }
        statusLeft={
          <>
            <StatusSegment title="Workspace owner">
              <span className="text-zinc-200">{displayName}</span>
            </StatusSegment>
            {generatingCount > 0 ? (
              <StatusSegment pulse className="text-gold">
                {generatingCount} app{generatingCount === 1 ? "" : "s"} building
              </StatusSegment>
            ) : null}
            {error ? <StatusSegment className="text-rose-300">tree load failed</StatusSegment> : null}
          </>
        }
        statusRight={
          <>
            <StatusSegment title="Workspace contents">
              {loading ? "…" : `${projects.length} apps · ${liveCount} live`}
            </StatusSegment>
            <StatusSegment className="hidden sm:flex" title="Active file language">
              Markdown
            </StatusSegment>
            <LnCol />
            <Encoding />
            <StatusSegment className="hidden sm:flex" title="AI backend">
              <span className="size-1.5 animate-pulse rounded-full bg-gold" aria-hidden="true" />
              Z.AI connected
            </StatusSegment>
            <Bell />
          </>
        }
        panel={panel}
        onOpenProblems={() => setPanelTab("problems")}
        chat={
          <ChatDock
            projectName="workspace"
            messages={chatMessages}
            generating={false}
            buildLabel={null}
            error={null}
            sending={chatSending}
            asking={false}
            mode={chatMode}
            onModeChange={setChatMode}
            onSend={handleChatSend}
            onClose={() => setChatOpen(false)}
          />
        }
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
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
