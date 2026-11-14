"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
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
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import {
  Breadcrumbs,
  CodeEditor,
  EmptyEditor,
  FileIcon,
  IdeTab,
} from "@/components/ide/editor-chrome";
import { BuilderExplorer, type BuilderExplorerTab } from "@/components/ide/builder-explorer";
import { ChatDock } from "@/components/ide/chat-dock";
import { IdeShell, IdeShellSkeleton } from "@/components/ide/ide-shell";
import { useImporters } from "@/components/ide/import-controls";
import {
  CodeSearchView,
  DebugView,
  ExtensionsView,
  ScmView,
} from "@/components/ide/views";
import { OutputView, TerminalView, type PanelTab } from "@/components/ide/panel-bottom";
import {
  Bell,
  Encoding,
  GoLive,
  LnCol,
  StatusSegment,
} from "@/components/ide/status-bar";
import { DiffView } from "@/components/builder/diff-view";
import {
  PreviewPanel,
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
import { languageLabel, splitProjectFiles } from "@/lib/project-files";
import type { MessageT, ProjectDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

type LoadError = { status: number; message: string };

const PREVIEW_TAB = "preview";
const DIFF_TAB = "diff";

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

  /* Editor state — open tabs are ids: "preview" | "diff" | file path. */
  const [openTabs, setOpenTabs] = useState<string[]>([PREVIEW_TAB]);
  const [activeTab, setActiveTab] = useState<string>(PREVIEW_TAB);
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

  /* Bottom panel tab + copied flag for the code action strip */
  const [panelTab, setPanelTab] = useState<PanelTab>("terminal");
  const [copied, setCopied] = useState(false);
  const importers = useImporters();
  const [createOpen, setCreateOpen] = useState(false);

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
  const files = useMemo(
    () =>
      splitProjectFiles(
        project?.html ?? null,
        project?.name ?? "app",
        project?.original_prompt ?? ""
      ),
    [project?.html, project?.name, project?.original_prompt]
  );

  const activeFile = useMemo(
    () => files.find((f) => f.path === activeTab) ?? null,
    [files, activeTab]
  );

  /* Keep the active tab valid when the file set changes after a rebuild. */
  useEffect(() => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t === PREVIEW_TAB || t === DIFF_TAB || files.some((f) => f.path === t));
      return next.length ? next : [PREVIEW_TAB];
    });
    setActiveTab((t) =>
      t === PREVIEW_TAB || t === DIFF_TAB || files.some((f) => f.path === t)
        ? t
        : PREVIEW_TAB
    );
  }, [files]);

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

  const lastAssistant = useMemo(
    () => [...visibleMessages].reverse().find((m) => m.role === "assistant"),
    [visibleMessages]
  );

  /* Output log from the conversation (safe before the early returns). */
  const outputLines = useMemo(() => {
    const lines: { kind: "info" | "ok" | "warn" | "error" | "cmd"; text: string }[] = [];
    if (!project) return lines;
    lines.push({ kind: "info", text: `[lovify] workspace "${project.name}" opened` });
    lines.push({
      kind: "info",
      text: `[lovify] brief: ${project.original_prompt.slice(0, 90)}${project.original_prompt.length > 90 ? "…" : ""}`,
    });
    for (const m of project.messages) {
      if (m.role === "user") {
        lines.push({ kind: "cmd", text: `[you] ${displayContent(m.content).slice(0, 110)}` });
      } else {
        lines.push({
          kind: "ok",
          text: `[z.ai] ${displayContent(m.content).slice(0, 110).replace(/\n/g, " ")}`,
        });
      }
    }
    if (project.status === "generating") {
      lines.push({ kind: "warn", text: `[lovify] building v${project.version + 1} with Z.AI…` });
    }
    if (project.status === "error" && project.error) {
      lines.push({ kind: "error", text: `[lovify] ${project.error}` });
    }
    return lines;
  }, [project]);

  const publishFullUrl = useMemo(() => {
    if (!publishUrl) return "";
    if (/^https?:\/\//i.test(publishUrl)) return publishUrl;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}${publishUrl}`;
  }, [publishUrl]);

  /* -------------------------------- Tab helpers ------------------------------ */
  const openTab = useCallback((tabId: string) => {
    setOpenTabs((tabs) => (tabs.includes(tabId) ? tabs : [...tabs, tabId]));
    setActiveTab(tabId);
    if (window.matchMedia("(max-width: 1023px)").matches) setMobileTab("preview");
  }, []);

  const openDiff = useCallback(
    (from: number | null, to: number) => {
      setDiffFrom(from);
      setDiffTo(to);
      openTab(DIFF_TAB);
    },
    [openTab]
  );

  const closeTab = useCallback((tabId: string) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== tabId);
      if (!next.includes(PREVIEW_TAB)) next.push(PREVIEW_TAB);
      return next;
    });
    setActiveTab((cur) => (cur === tabId ? PREVIEW_TAB : cur));
  }, []);

  const onExplorerTab = useCallback(
    (t: BuilderExplorerTab) => {
      if (t === "code") {
        openTab(files[0]?.path ?? PREVIEW_TAB);
      } else {
        openTab(t);
      }
    },
    [files, openTab]
  );

  /* Shared version picker for the Diff tab */
  const diffSelector = (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#2b2b2b] bg-[#181818] px-4 py-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
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

  async function copyActiveFile() {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast.success(`Copied ${activeFile.label}`);
    } catch {
      toast.error("Could not copy the code");
    }
  }

  /* Load the two selected versions' HTML when the diff tab is active —
     and whenever the compare pickers (or explorer rows) change. */
  const versionsKey = project?.versions.map((v) => v.version).join(",") ?? "";
  useEffect(() => {
    if (activeTab !== DIFF_TAB || !versionsKey) return;
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
  }, [activeTab, versionsKey, diffFrom, diffTo]);

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
      files={files}
      activeTab={activeTab === DIFF_TAB ? "diff" : activeTab === PREVIEW_TAB ? "preview" : "code"}
      activeFile={activeFile?.path ?? ""}
      diffTo={diffTo}
      restoringVersion={restoringVersion}
      generating={!!generating}
      publishing={publishing}
      onOpenTab={(t) => {
        if (t === "code") openTab(files[0]?.path ?? PREVIEW_TAB);
        else openTab(t);
      }}
      onOpenFile={(path) => openTab(path)}
      onOpenDiff={(from, to) => openDiff(from, to)}
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
    <a
      href={`/p/${project.published_slug}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View live app"
      title="View live app"
      className="inline-flex h-6.5 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs text-zinc-300 transition-colors hover:bg-white/[0.08]"
    >
      <Globe className="size-3.5" />
      <span className="hidden sm:inline">Live</span>
    </a>
  ) : (
    <button
      type="button"
      onClick={handlePublish}
      disabled={generating || publishing}
      title="Publish this app"
      className="inline-flex h-6.5 items-center gap-1.5 rounded-md bg-gold px-2.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {publishing ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Rocket className="size-3.5" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">Publish</span>
    </button>
  );

  /* Editor action strip (right of the tab strip) */
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

  const fileActions = activeFile ? (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Explain this code with Z.AI"
        title="Explain this code (Z.AI)"
        onClick={() => void handleExplain()}
        className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
      >
        <Lightbulb className="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Download the app HTML"
        title="Download app (⌘S)"
        onClick={handleDownload}
        className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
      >
        <Download className="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Copy file"
        title="Copy file"
        onClick={() => void copyActiveFile()}
        className="inline-flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
      >
        {copied ? (
          <Check className="size-3.5 text-gold" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  ) : null;

  /* Tab strip */
  const tabStrip = (
    <>
      {openTabs.map((t) => {
        if (t === PREVIEW_TAB) {
          return (
            <IdeTab
              key={t}
              active={activeTab === t}
              onClick={() => setActiveTab(t)}
              icon={<Monitor className="size-3.5 text-[#29B8DB]" aria-hidden="true" />}
              label="Live Preview"
            />
          );
        }
        if (t === DIFF_TAB) {
          return (
            <IdeTab
              key={t}
              active={activeTab === t}
              onClick={() => setActiveTab(t)}
              onClose={() => closeTab(t)}
              icon={<GitCompareArrows className="size-3.5 text-zinc-400" aria-hidden="true" />}
              label="versions.diff"
            />
          );
        }
        const f = files.find((ff) => ff.path === t);
        if (!f) return null;
        return (
          <IdeTab
            key={t}
            active={activeTab === t}
            onClick={() => setActiveTab(t)}
            onClose={() => closeTab(t)}
            icon={<FileIcon lang={f.lang} />}
            label={f.label}
          />
        );
      })}
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
  );

  /* Breadcrumbs */
  const breadcrumbTrail = (() => {
    if (activeFile) {
      return [
        { label: project.name },
        ...activeFile.path.split("/").map((part, i, arr) => ({
          label: part,
          lang: i === arr.length - 1 ? activeFile.lang : undefined,
        })),
      ];
    }
    if (activeTab === DIFF_TAB) {
      return [{ label: project.name }, { label: "versions.diff", lang: "diff" as const }];
    }
    return [{ label: project.name }, { label: "Live Preview" }];
  })();

  /* Editor content — shared by desktop editor column and mobile stack */
  const editorContent =
    activeFile ? (
      <CodeEditor file={activeFile} />
    ) : activeTab === DIFF_TAB ? (
      <div className="flex h-full flex-col">
        {diffSelector}
        <DiffView
          before={diffBefore}
          after={diffAfter}
          loading={diffLoading}
          className="min-h-0 flex-1"
        />
      </div>
    ) : (
      <PreviewPanel
        project={project}
        tab="preview"
        device={device}
        previewKey={previewKey}
        generating={!!generating}
        onRefresh={() => setPreviewKey((k) => k + 1)}
        onDownload={handleDownload}
        onExplain={() => void handleExplain()}
      />
    );

  const chatDock = (
    <ChatDock
      projectName={project.name}
      messages={visibleMessages}
      generating={!!generating}
      buildLabel={generating ? `building v${project.version + 1}` : null}
      error={project.status === "error" ? project.error ?? "Unknown error" : null}
      sending={sending}
      asking={thinking}
      mode={mode}
      onModeChange={setMode}
      onSend={handleSend}
      onClose={() => setChatOpen(false)}
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
      <StatusSegment title="Version · messages" className="hidden sm:flex">
        v{project.version} · {project.messages.length} msg
      </StatusSegment>
    </>
  );

  const statusRight = (
    <>
      {activeFile ? (
        <StatusSegment title="Language" className="hidden sm:flex">{languageLabel(activeFile.lang)}</StatusSegment>
      ) : (
        <StatusSegment title="View" className="hidden sm:flex">{activeTab === DIFF_TAB ? "Diff" : "Preview"}</StatusSegment>
      )}
      <LnCol />
      <Encoding />
      <GoLive
        live={!!project.published_slug}
        onClick={
          project.published_slug
            ? () => window.open(`/p/${project.published_slug}`, "_blank")
            : () => void handlePublish()
        }
      />
      <StatusSegment className="hidden sm:flex" title="AI backend">
        <span className="size-1.5 animate-pulse rounded-full bg-gold" aria-hidden="true" />
        Z.AI
      </StatusSegment>
      <Bell />
    </>
  );

  /* Bottom panel */
  const panel = {
    tabs: ["problems", "output", "terminal"] as PanelTab[],
    active: panelTab,
    onActive: setPanelTab,
    content:
      panelTab === "problems" ? (
        <div className="flex h-full items-center justify-center gap-2 px-4 text-xs text-zinc-500">
          {project.status === "error" && project.error ? (
            <span className="text-rose-300">✖ {project.error}</span>
          ) : (
            <span>No problems have been detected in the workspace.</span>
          )}
        </div>
      ) : panelTab === "output" ? (
        <OutputView lines={outputLines} />
      ) : (
        <TerminalView
          intro={[`workspace: ${project.name} · v${project.version} · ${project.status}`]}
          files={files.map((f) => f.path)}
          statusLine={`v${project.version} · ${generating ? "building" : project.status} · Z.AI connected`}
          onOpenPreview={() => openTab(PREVIEW_TAB)}
        />
      ),
  };

  const menu = {
    onNewProject: () => setCreateOpen(true),
    onImportFolder: importers.openFolder,
    onImportFiles: importers.openFiles,
    onDownload: handleDownload,
    onPublish: project.published_slug
      ? () => window.open(`/p/${project.published_slug}`, "_blank")
      : () => void handlePublish(),
    onOpenPreview: () => openTab(PREVIEW_TAB),
    onRefreshPreview: () => setPreviewKey((k) => k + 1),
    onCloseWorkspace: () => window.location.assign("/dashboard"),
  };

  /* ------------------------------- Desktop IDE ------------------------------- */
  if (isDesktop) {
    return (
      <>
        <IdeShell
          title={project.name}
          menu={menu}
          actions={
            <>
              {titleActions}
              {importers.inputs}
            </>
          }
          mainClassName="overflow-hidden"
          badges={generating ? { explorer: 1 } : undefined}
          views={{
            explorer,
            search: (
              <CodeSearchView
                files={files}
                onOpenFile={(path) => openTab(path)}
              />
            ),
            scm: (
              <ScmView
                versions={project.versions}
                currentVersion={project.version}
                generating={!!generating}
                restoringVersion={restoringVersion}
                onCompare={(from, to) => openDiff(from, to)}
                onRestore={(v) => void handleRestore(v)}
              />
            ),
            debug: (
              <DebugView
                generating={!!generating}
                onRun={() => openTab(PREVIEW_TAB)}
              />
            ),
            extensions: <ExtensionsView />,
          }}
          tabs={tabStrip}
          tabActions={activeTab === PREVIEW_TAB ? devicePicker : fileActions}
          breadcrumb={<Breadcrumbs trail={breadcrumbTrail} />}
          statusLeft={statusLeft}
          statusRight={statusRight}
          panel={panel}
          onOpenProblems={() => setPanelTab("problems")}
          chat={chatDock}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
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
        <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      </>
    );
  }

  /* ------------------------- Mobile / tablet stack ------------------------- */
  return (
    <>
      <IdeShell
        title={project.name}
        menu={menu}
        actions={
          <>
            {titleActions}
            {importers.inputs}
          </>
        }
        mainClassName="overflow-hidden"
        views={{ explorer }}
        statusLeft={statusLeft}
        statusRight={statusRight}
        panel={panel}
        onOpenProblems={() => setPanelTab("problems")}
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
      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

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
