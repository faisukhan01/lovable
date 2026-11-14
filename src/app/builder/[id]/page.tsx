"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Code2,
  Copy,
  Download,
  FileQuestion,
  GitCompareArrows,
  Globe,
  Lightbulb,
  Loader2,
  MessageSquare,
  Monitor,
  PanelTop,
  Rocket,
  Smartphone,
  Tablet,
} from "lucide-react";
import { toast } from "sonner";

import { ChatPanel, displayContent, expandSlash, type ChatMode } from "@/components/builder/chat-panel";
import { StatusBar, StatusSegment } from "@/components/ide/status-bar";
import { BuilderExplorer, type BuilderExplorerTab } from "@/components/ide/builder-explorer";
import { IdeShell, IdeShellSkeleton } from "@/components/ide/ide-shell";
import { DiffView } from "@/components/builder/diff-view";
import {
  PreviewPanel,
  type BuilderTab,
  type DeviceMode,
} from "@/components/builder/preview-panel";
import { useMinWidth } from "@/components/builder/use-min-width";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ApiError,
  askAboutProject,
  chatOnProject,
  explainCode,
  getProject,
  getVersionHtml,
  planForProject,
  publishProject,
  renameProject,
  restoreVersion,
} from "@/lib/api";
import type { MessageT, ProjectDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

type LoadError = { status: number; message: string };

function SegBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
        active
          ? "bg-white/10 text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/** A VS Code editor tab — flat strip, gold top edge on the active tab. */
function IdeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 border-r border-white/[0.06] border-t-2 px-3 text-xs transition-colors",
        active
          ? "border-t-gold bg-background text-foreground"
          : "border-t-transparent text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
      )}
    >
      <span className={active ? "text-gold" : "text-zinc-500"} aria-hidden="true">
        {icon}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

export default function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [sending, setSending] = useState(false);
  const [optimistic, setOptimistic] = useState<MessageT[]>([]);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [tab, setTab] = useState<BuilderTab>("preview");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("preview");
  const [previewKey, setPreviewKey] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);

  /* Ask / Plan / Explain / Diff state */
  const [mode, setMode] = useState<ChatMode>("build");
  const [thinking, setThinking] = useState(false); // ask/plan in flight
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainText, setExplainText] = useState("");
  const [diffFrom, setDiffFrom] = useState<number | null>(null);
  const [diffTo, setDiffTo] = useState<number | null>(null);
  const [diffBefore, setDiffBefore] = useState("");
  const [diffAfter, setDiffAfter] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);

  const isDesktop = useMinWidth(1024);
  const generating = project?.status === "generating";

  /* ------------------------------ Initial load ------------------------------ */
  useEffect(() => {
    let cancelled = false;
    setLoadingInitial(true);
    setLoadError(null);
    getProject(id)
      .then((p) => {
        if (!cancelled) setProject(p);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError({
          status: err instanceof ApiError ? err.status : 0,
          message:
            err instanceof Error ? err.message : "Failed to load the project.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, loadAttempt]);

  /* ------------------- Polling while the app is generating ------------------ */
  useEffect(() => {
    if (project?.status !== "generating") return;
    const timer = setInterval(async () => {
      try {
        const fresh = await getProject(id);
        setProject(fresh);
        // Drop optimistic copies that the refetch already returned.
        setOptimistic((prev) =>
          prev.filter(
            (om) =>
              !fresh.messages.some(
                (m) => m.role === om.role && m.content === om.content
              )
          )
        );
      } catch {
        /* transient poll failure — keep trying */
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [id, project?.status]);

  /* ------------------------------ Derived data ------------------------------ */
  const visibleMessages = useMemo(() => {
    if (!project) return [];
    const out = [...project.messages];
    for (const om of optimistic) {
      const exists = project.messages.some(
        (m) => m.role === om.role && m.content === om.content
      );
      if (!exists) out.push(om);
    }
    return out;
  }, [project, optimistic]);

  const publishFullUrl = useMemo(() => {
    if (!publishUrl) return "";
    if (/^https?:\/\//i.test(publishUrl)) return publishUrl;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}${publishUrl}`;
  }, [publishUrl]);

  /* Shared version picker for the Diff tab */
  const diffSelector = (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Compare
      </span>
      <Select
        value={diffFrom != null ? String(diffFrom) : ""}
        onValueChange={(v) => setDiffFrom(Number(v))}
      >
        <SelectTrigger className="h-8 w-[190px] rounded-lg border-white/10 bg-white/[0.03] text-xs" aria-label="Base version">
          <SelectValue placeholder="base version" />
        </SelectTrigger>
        <SelectContent>
          {(project?.versions ?? []).map((v) => (
            <SelectItem key={v.id} value={String(v.version)} className="text-xs">
              v{v.version} · {displayContent(v.label).slice(0, 34) || "build"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span aria-hidden className="text-xs text-muted-foreground">→</span>
      <Select
        value={diffTo != null ? String(diffTo) : ""}
        onValueChange={(v) => setDiffTo(Number(v))}
      >
        <SelectTrigger className="h-8 w-[190px] rounded-lg border-white/10 bg-white/[0.03] text-xs" aria-label="Compare version">
          <SelectValue placeholder="compare version" />
        </SelectTrigger>
        <SelectContent>
          {(project?.versions ?? []).map((v) => (
            <SelectItem key={v.id} value={String(v.version)} className="text-xs">
              v{v.version} · {displayContent(v.label).slice(0, 34) || "build"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(project?.versions.length ?? 0) < 2 ? (
        <span className="text-[11px] text-muted-foreground">
          Build one more version to compare
        </span>
      ) : null}
    </div>
  );

  /* -------------------------------- Handlers -------------------------------- */
  const handleSend = useCallback(
    async (raw: string): Promise<boolean> => {
      if (!project || sending || thinking) return false;
      const parsed = expandSlash(raw);
      const text = parsed.text.trim();
      if (!text) return false;

      const optimisticMsg: MessageT = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      const prev = project;

      /* ---- Ask mode: read-only answers, never edits ---- */
      if (mode === "ask" || parsed.ask) {
        setOptimistic((o) => [...o, optimisticMsg]);
        setThinking(true);
        try {
          await askAboutProject(id, text);
          const fresh = await getProject(id);
          setProject(fresh);
          setOptimistic([]);
          return true;
        } catch (err) {
          setOptimistic((o) => o.filter((m) => m.id !== optimisticMsg.id));
          toast.error(
            err instanceof ApiError
              ? err.message
              : "Could not get an answer. Please try again."
          );
          return false;
        } finally {
          setThinking(false);
        }
      }

      /* ---- Plan mode: roadmap without touching code (/plan) ---- */
      if (parsed.plan) {
        if (project.status === "generating") {
          toast.error("Wait for the current build to finish, then plan.");
          return false;
        }
        setOptimistic((o) => [...o, optimisticMsg]);
        setThinking(true);
        try {
          await planForProject(id, text);
          const fresh = await getProject(id);
          setProject(fresh);
          setOptimistic([]);
          return true;
        } catch (err) {
          setOptimistic((o) => o.filter((m) => m.id !== optimisticMsg.id));
          toast.error(
            err instanceof ApiError
              ? err.message
              : "Could not draft a plan. Please try again."
          );
          return false;
        } finally {
          setThinking(false);
        }
      }

      /* ---- Build mode: rebuild the app ---- */
      if (project.status === "generating") return false;
      setOptimistic((o) => [...o, optimisticMsg]);
      setProject({ ...project, status: "generating", error: null });
      setSending(true);
      try {
        await chatOnProject(id, text);
        return true; // polling takes it from here
      } catch (err) {
        setProject(prev);
        setOptimistic((o) => o.filter((m) => m.id !== optimisticMsg.id));
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Could not send your message. Please try again."
        );
        return false;
      } finally {
        setSending(false);
      }
    },
    [id, project, sending, thinking, mode]
  );

  async function handleRestore(version: number) {
    if (!project || generating || restoringVersion !== null) return;
    setRestoringVersion(version);
    try {
      const updated = await restoreVersion(id, version);
      setProject(updated);
      setPreviewKey((k) => k + 1);
      toast.success(`Restored v${version}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not restore that version."
      );
    } finally {
      setRestoringVersion(null);
    }
  }

  async function handlePublish() {
    if (!project || generating || publishing) return;
    setPublishing(true);
    try {
      const res = await publishProject(id);
      setProject({ ...project, published_slug: res.slug });
      setPublishUrl(res.url);
      setPublishOpen(true);
      toast.success("Your app is live");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Publishing failed. Please try again."
      );
    } finally {
      setPublishing(false);
    }
  }

  async function copyPublishUrl() {
    try {
      await navigator.clipboard.writeText(publishFullUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  async function handleRename() {
    const name = renameValue.trim();
    if (!name || renaming || !project) return;
    setRenaming(true);
    try {
      await renameProject(id, name);
      setProject({ ...project, name });
      setRenameOpen(false);
      toast.success("Renamed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Rename failed");
    } finally {
      setRenaming(false);
    }
  }

  function handleDownload() {
    if (!project?.html) {
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

  /* ⌘/Ctrl + S downloads the current HTML */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleDownload();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project?.html, project?.name]);

  async function handleExplain() {
    if (!project?.html || explainLoading) return;
    setExplainOpen(true);
    setExplainLoading(true);
    setExplainText("");
    try {
      const reply = await explainCode(project.html, project.name);
      setExplainText(reply);
    } catch (err) {
      setExplainOpen(false);
      toast.error(
        err instanceof ApiError ? err.message : "The explainer is busy. Try again in a moment."
      );
    } finally {
      setExplainLoading(false);
    }
  }

  /* Load the two selected versions' HTML when the diff tab is active —
     and whenever the compare pickers (or explorer rows) change. */
  const versionsKey = project?.versions.map((v) => v.version).join(",") ?? "";
  useEffect(() => {
    if (tab !== "diff" || !versionsKey) return;
    const nums = versionsKey.split(",").map(Number);
    const to = diffTo ?? nums[0];
    const from = diffFrom ?? nums[1] ?? nums[0];
    if (diffTo !== to || diffFrom !== from) {
      /* First entry on the tab — pin defaults, then the re-run fetches. */
      setDiffTo(to);
      setDiffFrom(from);
      return;
    }
    let cancelled = false;
    setDiffLoading(true);
    Promise.all([
      getVersionHtml(id, from).catch(() => null),
      getVersionHtml(id, to).catch(() => null),
    ])
      .then(([f, t]) => {
        if (cancelled) return;
        setDiffBefore(f?.html ?? "");
        setDiffAfter(t?.html ?? "");
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, versionsKey, diffFrom, diffTo]);

  /* --------------------------------- Screens -------------------------------- */
  if (loadingInitial) {
    /* The IDE frame stays up while the workspace loads — no bare-spinner
       flash between "Start building" and the builder. */
    return <IdeShellSkeleton hint="Opening builder…" />;
  }

  if (loadError) {
    const notFound = loadError.status === 404;
    const unauthenticated = loadError.status === 401;
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <div className="glass-panel w-full max-w-sm rounded-xl p-8 text-center">
          <div
            className={cn(
              "mx-auto flex size-14 items-center justify-center rounded-xl",
              notFound || unauthenticated
                ? "border border-gold/25 bg-gold/10"
                : "border border-rose-400/25 bg-rose-500/10"
            )}
          >
            <FileQuestion
              className={cn(
                "size-6",
                notFound || unauthenticated ? "text-gold" : "text-rose-400"
              )}
            />
          </div>
          <h1 className="mt-5 font-display text-xl tracking-normal">
            {notFound
              ? "Project not found"
              : unauthenticated
                ? "Please sign in again"
                : "Something went wrong"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {notFound
              ? "It may have been deleted, or the link is wrong."
              : loadError.message}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {notFound ? (
              <Button asChild variant="outline">
                <Link href="/dashboard">
                  <ArrowLeft className="size-4" />
                  Back to workspace
                </Link>
              </Button>
            ) : unauthenticated ? (
              <Button asChild>
                <Link href="/auth">Sign in</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setLoadAttempt((a) => a + 1)}
              >
                Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  /* --------------------------------- Layout --------------------------------- */

  /* Explorer (same tree on desktop sidebar and mobile drawer) */
  const explorer = (
    <BuilderExplorer
      project={project}
      activeTab={tab}
      diffTo={diffTo}
      restoringVersion={restoringVersion}
      generating={!!generating}
      publishing={publishing}
      onOpenTab={(t: BuilderExplorerTab) => {
        setTab(t);
        if (!isDesktop) setMobileTab("preview");
      }}
      onOpenDiff={(from, to) => {
        setDiffFrom(from);
        setDiffTo(to);
        setTab("diff");
        if (!isDesktop) setMobileTab("preview");
      }}
      onRestore={(v) => void handleRestore(v)}
      onRename={() => {
        setRenameValue(project.name);
        setRenameOpen(true);
      }}
      onPublish={() => void handlePublish()}
      onDownload={handleDownload}
    />
  );

  /* Title-bar action — Publish / View live */
  const titleActions = project.published_slug ? (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-6.5 gap-1.5 rounded-md px-2 text-xs"
    >
      <a
        href={`/p/${project.published_slug}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View live app"
      >
        <Globe className="size-3.5" />
        <span className="hidden sm:inline">Live</span>
      </a>
    </Button>
  ) : (
    <Button
      size="sm"
      onClick={handlePublish}
      disabled={generating || publishing}
      className="h-6.5 gap-1.5 rounded-md px-2.5 text-xs"
    >
      {publishing ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Rocket className="size-3.5" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">Publish</span>
    </Button>
  );

  /* Device picker — shown on the tab strip while previewing */
  const devicePicker = (
    <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      <SegBtn active={device === "desktop"} onClick={() => setDevice("desktop")} label="Desktop preview">
        <Monitor className="size-3.5" />
      </SegBtn>
      <SegBtn active={device === "tablet"} onClick={() => setDevice("tablet")} label="Tablet preview">
        <Tablet className="size-3.5" />
      </SegBtn>
      <SegBtn active={device === "mobile"} onClick={() => setDevice("mobile")} label="Mobile preview">
        <Smartphone className="size-3.5" />
      </SegBtn>
    </div>
  );

  /* Editor content — shared by desktop editor column and mobile stack */
  const editorContent = (
    <PreviewPanel
      project={project}
      tab={tab}
      device={device}
      previewKey={previewKey}
      generating={!!generating}
      onRefresh={() => setPreviewKey((k) => k + 1)}
      onDownload={handleDownload}
      onExplain={() => void handleExplain()}
    >
      {tab === "diff" ? (
        <div className="flex h-full flex-col">
          {diffSelector}
          <DiffView
            before={diffBefore}
            after={diffAfter}
            loading={diffLoading}
            className="min-h-0 flex-1"
          />
        </div>
      ) : null}
    </PreviewPanel>
  );

  const chatPanel = (
    <ChatPanel
      project={project}
      messages={visibleMessages}
      generating={!!generating}
      sending={sending}
      asking={thinking}
      mode={mode}
      onModeChange={setMode}
      onSend={handleSend}
      className="border-r-0 border-l border-white/[0.06]"
    />
  );

  const statusLeft = (
    <>
      <StatusSegment pulse={!!generating} className={generating ? "text-gold" : ""}>
        {generating
          ? `building v${project.version + 1}`
          : project.status === "error"
            ? "last build failed"
            : "ready"}
      </StatusSegment>
      <StatusSegment>
        v{project.version} · {project.messages.length} msg
      </StatusSegment>
    </>
  );

  const statusRight = (
    <>
      {tab === "preview" ? (
        <StatusSegment className="hidden sm:flex">{device} preview</StatusSegment>
      ) : null}
      <StatusSegment>{tab} view</StatusSegment>
      <StatusSegment className="hidden sm:flex">
        <span className="size-1.5 animate-pulse rounded-full bg-gold" aria-hidden="true" />
        Z.AI connected
      </StatusSegment>
    </>
  );

  /* ------------------------------- Desktop IDE ------------------------------- */
  if (isDesktop) {
    return (
      <>
        <IdeShell
          sidebar={explorer}
          actions={titleActions}
          mainClassName="overflow-hidden"
          breadcrumb={
            tab === "preview" ? (
              devicePicker
            ) : tab === "code" ? (
              <span aria-hidden="true">
                lovify <span className="text-zinc-700">/</span> {project.name}{" "}
                <span className="text-zinc-700">/</span>{" "}
                <span className="text-zinc-500">index.html</span>
              </span>
            ) : (
              <span aria-hidden="true">
                lovify <span className="text-zinc-700">/</span> {project.name}{" "}
                <span className="text-zinc-700">/</span>{" "}
                <span className="text-zinc-500">versions.diff</span>
              </span>
            )
          }
          statusLeft={statusLeft}
          statusRight={statusRight}
          chat={chatPanel}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
          tabs={
            <>
              <IdeTab
                active={tab === "preview"}
                onClick={() => setTab("preview")}
                icon={<PanelTop className="size-3.5" />}
                label="Preview"
              />
              <IdeTab
                active={tab === "code"}
                onClick={() => setTab("code")}
                icon={<Code2 className="size-3.5" />}
                label="index.html"
              />
              <IdeTab
                active={tab === "diff"}
                onClick={() => setTab("diff")}
                icon={<GitCompareArrows className="size-3.5" />}
                label="versions.diff"
              />
              {generating ? (
                <span
                  className="flex items-center gap-1.5 self-center px-3 font-mono text-[9px] uppercase tracking-[0.16em] text-gold"
                  role="status"
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-gold" aria-hidden="true" />
                  building
                </span>
              ) : null}
            </>
          }
        >
          {editorContent}
        </IdeShell>

        <RenameDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          renaming={renaming}
          onRename={() => void handleRename()}
        />
        <ExplainDialog
          open={explainOpen}
          onOpenChange={setExplainOpen}
          loading={explainLoading}
          text={explainText}
        />
        <PublishDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          url={publishFullUrl}
          onCopy={() => void copyPublishUrl()}
        />
      </>
    );
  }

  /* ------------------------- Mobile / tablet stack ------------------------- */
  return (
    <>
      <IdeShell
        sidebar={explorer}
        actions={titleActions}
        mainClassName="overflow-hidden"
        statusLeft={statusLeft}
        statusRight={statusRight}
        tabs={
          <div className="flex items-center gap-1 px-2">
            <SegBtn
              active={mobileTab === "chat"}
              onClick={() => setMobileTab("chat")}
              label="AI chat"
            >
              <MessageSquare className="size-3.5" />
              Chat
            </SegBtn>
            <SegBtn
              active={mobileTab === "preview"}
              onClick={() => setMobileTab("preview")}
              label="Editor"
            >
              <PanelTop className="size-3.5" />
              Editor
            </SegBtn>
          </div>
        }
      >
        {mobileTab === "chat" ? (
          <ChatPanel
            project={project}
            messages={visibleMessages}
            generating={!!generating}
            sending={sending}
            asking={thinking}
            mode={mode}
            onModeChange={setMode}
            onSend={handleSend}
            className="border-r-0"
          />
        ) : (
          editorContent
        )}
      </IdeShell>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        renaming={renaming}
        onRename={() => void handleRename()}
      />
      <ExplainDialog
        open={explainOpen}
        onOpenChange={setExplainOpen}
        loading={explainLoading}
        text={explainText}
      />
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        url={publishFullUrl}
        onCopy={() => void copyPublishUrl()}
      />
    </>
  );
}

/* ------------------------------ Shared dialogs ----------------------------- */

function RenameDialog({
  open,
  onOpenChange,
  renameValue,
  setRenameValue,
  renaming,
  onRename,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  renaming: boolean;
  onRename: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-normal">Rename app</DialogTitle>
          <DialogDescription>
            A clear name helps you find it later in the explorer.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRename();
          }}
          aria-label="App name"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={renaming}>
            Cancel
          </Button>
          <Button onClick={onRename} disabled={renaming || !renameValue.trim()}>
            {renaming ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExplainDialog({
  open,
  onOpenChange,
  loading,
  text,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  text: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 font-display text-xl tracking-normal">
            <Lightbulb className="size-4 text-gold" />
            How this app works
          </DialogTitle>
          <DialogDescription>
            Z.AI read the code and explains it — nothing was changed.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm leading-relaxed text-zinc-200">
          {loading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-gold" />
              Reading the code…
            </span>
          ) : (
            text
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishDialog({
  open,
  onOpenChange,
  url,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string;
  onCopy: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 font-display text-2xl tracking-normal">
            <span className="flex size-8 items-center justify-center rounded-lg border border-white/15 bg-primary">
              <Globe className="size-4 text-primary-foreground" />
            </span>
            Your app is live
          </DialogTitle>
          <DialogDescription>
            Anyone with this link can use your app. Share it anywhere.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-300">
            {url}
          </span>
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy className="size-3.5" />
            Copy
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild>
            <a href={url || "#"} target="_blank" rel="noopener noreferrer">
              <Globe className="size-4" />
              Open app
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
