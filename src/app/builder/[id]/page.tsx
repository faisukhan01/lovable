"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Code2,
  Copy,
  Download,
  FileQuestion,
  GitCompareArrows,
  Globe,
  History,
  Lightbulb,
  Loader2,
  Monitor,
  PanelTop,
  Pencil,
  Rocket,
  Smartphone,
  Tablet,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { toast } from "sonner";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { BrandLogo } from "@/components/brand-logo";
import { ChatPanel, displayContent, expandSlash, type ChatMode } from "@/components/builder/chat-panel";
import { DiffView } from "@/components/builder/diff-view";
import {
  PreviewPanel,
  type BuilderTab,
  type DeviceMode,
} from "@/components/builder/preview-panel";
import { useMinWidth } from "@/components/builder/use-min-width";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
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
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const [previewKey, setPreviewKey] = useState(0);

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

  /* Load the two selected versions' HTML when the diff tab is active */
  const versionsKey = project?.versions.map((v) => v.version).join(",") ?? "";
  useEffect(() => {
    if (tab !== "diff" || !versionsKey) return;
    const nums = versionsKey.split(",").map(Number);
    const to = diffTo ?? nums[0];
    const from = diffFrom ?? nums[1] ?? nums[0];
    setDiffTo(to);
    setDiffFrom(from);
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
  }, [tab, versionsKey]);

  /* --------------------------------- Screens -------------------------------- */
  if (loadingInitial) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="size-6 animate-spin text-gold" />
        <p className="text-sm text-muted-foreground">Opening builder…</p>
      </div>
    );
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
                  Back to dashboard
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
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header — row 1: identity + publish, row 2 (mobile): scrollable tools */}
      <header className="shrink-0 border-b border-white/[0.06] bg-background/60 px-2.5 backdrop-blur-xl sm:px-4">
        <div className="flex h-12 items-center gap-2 sm:h-14 sm:gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Back to dashboard"
          >
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Separator orientation="vertical" className="hidden h-5 sm:block" />

          <span className="truncate max-w-[120px] font-medium sm:max-w-xs">
            {project.name}
          </span>
          <Badge variant="outline" className="shrink-0">
            v{project.version}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            aria-label="Rename project"
            title="Rename"
            disabled={generating}
            onClick={() => {
              setRenameValue(project.name);
              setRenameOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          {generating ? (
            <Badge className="hidden shrink-0 border border-gold/30 bg-gold/10 text-gold hover:bg-gold/10 sm:inline-flex">
              <span className="size-1.5 animate-pulse rounded-full bg-gold" />
              Building…
            </Badge>
          ) : null}

          <div className="flex-1" />

          {/* Download HTML (desktop) */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label="Download app as HTML"
            title="Download HTML"
            disabled={!project.html}
            onClick={handleDownload}
          >
            <Download className="size-4" />
          </Button>

          {/* Version history (desktop) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:inline-flex"
                aria-label="Version history"
                title="Version history"
                disabled={generating || restoringVersion !== null}
              >
                {restoringVersion !== null ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <History className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
              {project.versions.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No versions yet
                </p>
              ) : (
                project.versions.map((v) => {
                  const d = v.created_at ? new Date(v.created_at) : null;
                  return (
                    <DropdownMenuItem
                      key={v.id}
                      disabled={restoringVersion !== null}
                      onClick={() => void handleRestore(v.version)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          v{v.version} · {v.label}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {d && isValid(d)
                            ? format(d, "MMM d, yyyy · HH:mm")
                            : ""}
                        </span>
                      </span>
                      {v.version === project.version ? (
                        <Check className="size-3.5 shrink-0 text-gold" />
                      ) : null}
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Device toggle (preview only, desktop) */}
          {tab === "preview" ? (
            <div className="hidden items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5 sm:flex">
              <SegBtn
                active={device === "desktop"}
                onClick={() => setDevice("desktop")}
                label="Desktop preview"
              >
                <Monitor className="size-3.5" />
              </SegBtn>
              <SegBtn
                active={device === "tablet"}
                onClick={() => setDevice("tablet")}
                label="Tablet preview"
              >
                <Tablet className="size-3.5" />
              </SegBtn>
              <SegBtn
                active={device === "mobile"}
                onClick={() => setDevice("mobile")}
                label="Mobile preview"
              >
                <Smartphone className="size-3.5" />
              </SegBtn>
            </div>
          ) : null}

          {/* Preview / Code / Diff segmented control (desktop) */}
          <div className="hidden items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5 md:flex">
            <SegBtn
              active={tab === "preview"}
              onClick={() => setTab("preview")}
              label="Preview"
            >
              <PanelTop className="size-3.5" />
              <span className="hidden md:inline">Preview</span>
            </SegBtn>
            <SegBtn
              active={tab === "code"}
              onClick={() => setTab("code")}
              label="Code"
            >
              <Code2 className="size-3.5" />
              <span className="hidden md:inline">Code</span>
            </SegBtn>
            <SegBtn
              active={tab === "diff"}
              onClick={() => setTab("diff")}
              label="Version diff"
            >
              <GitCompareArrows className="size-3.5" />
              <span className="hidden md:inline">Diff</span>
            </SegBtn>
          </div>

          {/* Publish / View live */}
          {project.published_slug ? (
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <a
                href={`/p/${project.published_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View live app"
              >
                <Globe className="size-4" />
                <span className="hidden sm:inline">View live</span>
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={generating || publishing}
              className="shrink-0"
            >
              {publishing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Rocket className="size-4" />
              )}
              <span className="hidden sm:inline">Publish</span>
            </Button>
          )}
        </div>

        {/* Row 2 — mobile-only scrollable tools */}
        <div className="flex h-11 items-center gap-1.5 overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1.5 text-xs text-muted-foreground"
            aria-label="Download app as HTML"
            disabled={!project.html}
            onClick={handleDownload}
          >
            <Download className="size-3.5" />
            HTML
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 gap-1.5 text-xs text-muted-foreground"
                aria-label="Version history"
                disabled={generating || restoringVersion !== null}
              >
                {restoringVersion !== null ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <History className="size-3.5" />
                )}
                History
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
              {project.versions.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No versions yet
                </p>
              ) : (
                project.versions.map((v) => {
                  const d = v.created_at ? new Date(v.created_at) : null;
                  return (
                    <DropdownMenuItem
                      key={v.id}
                      disabled={restoringVersion !== null}
                      onClick={() => void handleRestore(v.version)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          v{v.version} · {v.label}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {d && isValid(d)
                            ? format(d, "MMM d, yyyy · HH:mm")
                            : ""}
                        </span>
                      </span>
                      {v.version === project.version ? (
                        <Check className="size-3.5 shrink-0 text-gold" />
                      ) : null}
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            <SegBtn
              active={tab === "preview"}
              onClick={() => setTab("preview")}
              label="Preview"
            >
              <PanelTop className="size-3.5" />
              Preview
            </SegBtn>
            <SegBtn
              active={tab === "code"}
              onClick={() => setTab("code")}
              label="Code"
            >
              <Code2 className="size-3.5" />
              Code
            </SegBtn>
          </div>
          {tab === "preview" ? (
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
              <SegBtn
                active={device === "desktop"}
                onClick={() => setDevice("desktop")}
                label="Desktop preview"
              >
                <Monitor className="size-3.5" />
              </SegBtn>
              <SegBtn
                active={device === "tablet"}
                onClick={() => setDevice("tablet")}
                label="Tablet preview"
              >
                <Tablet className="size-3.5" />
              </SegBtn>
              <SegBtn
                active={device === "mobile"}
                onClick={() => setDevice("mobile")}
                label="Mobile preview"
              >
                <Smartphone className="size-3.5" />
              </SegBtn>
            </div>
          ) : null}

          {/* Preview / Code / Diff (mobile row) */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            <SegBtn active={tab === "diff"} onClick={() => setTab("diff")} label="Version diff">
              <GitCompareArrows className="size-3.5" />
              Diff
            </SegBtn>
          </div>
        </div>
      </header>

      {/* Body */}
      {isDesktop ? (
        <PanelGroup direction="horizontal" className="min-h-0 flex-1">
          <Panel defaultSize={38} minSize={28}>
            <ChatPanel
              project={project}
              messages={visibleMessages}
              generating={!!generating}
              sending={sending}
              asking={thinking}
              mode={mode}
              onModeChange={setMode}
              onSend={handleSend}
            />
          </Panel>
          <PanelResizeHandle className="relative w-px bg-white/[0.06] transition-colors after:absolute after:inset-y-0 after:left-1/2 after:z-10 after:w-1.5 after:-translate-x-1/2 focus-visible:outline-none data-[resize-handle-active]:bg-gold/50" />
          <Panel minSize={30}>
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
          </Panel>
        </PanelGroup>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Stacked tabs for small screens */}
          <div className="flex shrink-0 items-center gap-0.5 border-b border-white/[0.06] px-3 py-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
              <SegBtn
                active={mobileTab === "chat"}
                onClick={() => setMobileTab("chat")}
                label="Chat"
              >
                Chat
              </SegBtn>
              <SegBtn
                active={mobileTab === "preview"}
                onClick={() => setMobileTab("preview")}
                label="Preview"
              >
                Preview
              </SegBtn>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
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
              <PreviewPanel
                project={project}
                tab={tab === "code" ? "code" : tab}
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
            )}
          </div>
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-normal">Rename app</DialogTitle>
            <DialogDescription>
              A clear name helps you find it later on the dashboard.
            </DialogDescription>
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

      {/* Explain-code dialog */}
      <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
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
            {explainLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-gold" />
                Reading the code…
              </span>
            ) : (
              explainText
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExplainOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish success dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
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
              {publishFullUrl}
            </span>
            <Button variant="outline" size="sm" onClick={() => void copyPublishUrl()}>
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Close
            </Button>
            <Button asChild>
              <a
                href={publishFullUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe className="size-4" />
                Open app
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
