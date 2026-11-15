"use client";

/**
 * The Lovify IDE shell — a faithful VS Code / Cursor workspace frame.
 *
 *  ┌─────────────── title bar: File Edit Selection View Go Run ⋯ ───────┐
 *  │ act │ side bar │ tabs + breadcrumbs            │ AI chat (Cursor)  │
 *  │ ivy │ (views)   │ editor main ⇅ bottom panel    │ (right dock ⌘L)   │
 *  └──────────────────────── status bar ─────────────────────────────────┘
 *
 * The shell owns chrome and shortcuts (⌘B, ⌘J/Ctrl+`, ⌘L, ⇧⌘E, ⇧⌘F);
 * pages compose views, tabs, editor content and panel content.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { TitleBar, type TitleBarMenuActions } from "@/components/ide/title-bar";
import { ActivityBar } from "@/components/ide/activity-bar";
import type { SideView } from "@/components/ide/view-types";
import { BottomPanel, type PanelTab } from "@/components/ide/panel-bottom";
import { StatusBar } from "@/components/ide/status-bar";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "lovify:ide-sidebar";
const CHAT_KEY = "lovify:ide-chat";
const PANEL_KEY = "lovify:ide-panel";

export interface PanelConfig {
  tabs: PanelTab[];
  active: PanelTab;
  onActive: (t: PanelTab) => void;
  content: ReactNode;
  /** Height in px (default 220). */
  height?: number;
}

export function IdeShell({
  title,
  menu,
  views,
  badges,
  tabs,
  tabActions,
  breadcrumb,
  mainClassName,
  children,
  chat,
  chatOpen,
  onToggleChat,
  actions,
  panel,
  onOpenProblems,
  statusLeft,
  statusRight,
}: {
  /** Center title-pill text (project name / workspace). */
  title: string;
  menu: TitleBarMenuActions;
  /** Content per activity-bar view. Missing views fall back to a hint. */
  views: Partial<Record<SideView, ReactNode>>;
  /** Activity-bar count badges. */
  badges?: Partial<Record<SideView, number>>;
  /** Editor tab strip. */
  tabs?: ReactNode;
  /** Right side of the tab strip (device picker, actions). */
  tabActions?: ReactNode;
  /** Breadcrumb trail row under the tabs. */
  breadcrumb?: ReactNode;
  mainClassName?: string;
  children: ReactNode;
  /** Right-dock content (the Cursor AI chat). Desktop (lg+) only. */
  chat?: ReactNode;
  chatOpen?: boolean;
  onToggleChat?: () => void;
  /** Extra title-bar actions (Publish chip). */
  actions?: ReactNode;
  /** Bottom panel wiring; the shell renders it when open. */
  panel?: PanelConfig;
  /** Status-bar problems button handler (opens the panel). */
  onOpenProblems?: () => void;
  statusLeft?: ReactNode;
  statusRight?: ReactNode;
}) {
  /* ---------------------------- chrome state ---------------------------- */
  const [sidebarOpen, setSidebarOpen] = useState(
    () =>
      typeof window === "undefined" ||
      window.localStorage.getItem(SIDEBAR_KEY) !== "closed"
  );
  const [dockOpen, setDockOpen] = useState(
    () =>
      typeof window === "undefined" ||
      window.localStorage.getItem(CHAT_KEY) !== "closed"
  );
  const [panelOpen, setPanelOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem(PANEL_KEY);
    return saved ? saved === "open" : false;
  });
  const [activeView, setActiveView] = useState<SideView>("explorer");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isWide, setIsWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const chatVisible = chat !== undefined && (chatOpen ?? dockOpen) && isWide;

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => {
      const next = !v;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "open" : "closed");
      return next;
    });
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpen((v) => {
      const next = !v;
      window.localStorage.setItem(PANEL_KEY, next ? "open" : "closed");
      return next;
    });
  }, []);

  const openView = useCallback(
    (view: SideView) => {
      setActiveView((prev) => {
        if (prev === view) {
          /* clicking the active activity-bar icon hides the side bar */
          toggleSidebar();
          return prev;
        }
        setSidebarOpen(true);
        window.localStorage.setItem(SIDEBAR_KEY, "open");
        return view;
      });
      setDrawerOpen(false);
    },
    [toggleSidebar]
  );

  const toggleChat = useCallback(() => {
    if (onToggleChat) {
      onToggleChat();
      return;
    }
    setDockOpen((v) => {
      const next = !v;
      window.localStorage.setItem(CHAT_KEY, next ? "open" : "closed");
      return next;
    });
  }, [onToggleChat]);

  const openProblems = useCallback(() => {
    if (onOpenProblems) onOpenProblems();
    if (panel) panel.onActive("problems");
    setPanelOpen(true);
    window.localStorage.setItem(PANEL_KEY, "open");
  }, [onOpenProblems, panel]);

  /* ------------------------------ shortcuts ------------------------------ */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if ((mod && e.key.toLowerCase() === "j") || (mod && e.key === "`")) {
        e.preventDefault();
        if (panel) togglePanel();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        openView("explorer");
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openView("search");
        return;
      }
      if (
        mod &&
        e.key.toLowerCase() === "l" &&
        chat !== undefined &&
        isWide
      ) {
        e.preventDefault();
        toggleChat();
        return;
      }
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar, togglePanel, openView, toggleChat, chat, isWide, panel]);

  /* ------------------------------- render -------------------------------- */
  const activeViewContent =
    views[activeView] ?? (
      <div className="flex flex-1 items-start px-4 pt-8 text-[11.5px] leading-relaxed text-zinc-600">
        This view lives inside an app workspace — open one of your apps.
      </div>
    );

  const editorColumn = (
    <EditorColumn
      tabs={tabs}
      tabActions={tabActions}
      breadcrumb={breadcrumb}
      mainClassName={mainClassName}
      panel={panel}
      panelOpen={!!panel && panelOpen && isWide}
      isWide={isWide}
      onClosePanel={togglePanel}
    >
      {children}
    </EditorColumn>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#181818] text-zinc-200">
      <TitleBar
        title={title}
        menu={{ ...menu, onFindInFiles: menu.onFindInFiles ?? (() => openView("search")) }}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        onOpenDrawer={() => setDrawerOpen(true)}
        panelOpen={panelOpen}
        onTogglePanel={togglePanel}
        chatAvailable={chat !== undefined}
        chatOpen={chatVisible}
        onToggleChat={toggleChat}
        activeView={activeView}
        onOpenView={openView}
        actions={actions}
      />

      <div className="flex min-h-0 flex-1">
        <ActivityBar
          activeView={sidebarOpen || drawerOpen ? activeView : null}
          onSelect={openView}
          badges={badges}
        />

        {/* side bar — desktop */}
        {sidebarOpen ? (
          <aside
            aria-label={`${activeView} side bar`}
            className="hidden w-[240px] shrink-0 flex-col overflow-hidden border-r border-[#2b2b2b] bg-[#181818] md:flex"
          >
            {activeViewContent}
          </aside>
        ) : null}

        {/* side bar — mobile drawer */}
        {drawerOpen ? (
          <>
            <button
              type="button"
              aria-label="Close explorer overlay"
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <aside
              aria-label="Explorer"
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-[#2b2b2b] bg-[#181818] pt-11 md:hidden"
              onClickCapture={(e) => {
                const t = e.target as HTMLElement;
                if (t.closest("button, a, input")) setDrawerOpen(false);
              }}
            >
              {views.explorer ?? activeViewContent}
            </aside>
          </>
        ) : null}

        {/* editor + optional right AI dock (Cursor layout) */}
        {chat !== undefined ? (
          <PanelGroup direction="horizontal" className="min-h-0 flex-1">
            <Panel defaultSize={chatVisible ? 66 : 100} minSize={38}>
              {editorColumn}
            </Panel>
            {chatVisible ? (
              <>
                <PanelResizeHandle className="relative w-px bg-[#2b2b2b] transition-colors after:absolute after:inset-y-0 after:left-1/2 after:z-10 after:w-1.5 after:-translate-x-1/2 focus-visible:outline-none data-[resize-handle-active]:bg-gold/50" />
                <Panel defaultSize={34} minSize={22} className="bg-[#181818]">
                  {chat}
                </Panel>
              </>
            ) : null}
          </PanelGroup>
        ) : (
          editorColumn
        )}
      </div>

      <StatusBar left={statusLeft} right={statusRight} onOpenProblems={panel ? openProblems : undefined} />
    </div>
  );
}

/** Tabs + breadcrumbs + (editor ⇅ panel) — the center column. */
function EditorColumn({
  tabs,
  tabActions,
  breadcrumb,
  mainClassName,
  panel,
  panelOpen,
  isWide,
  onClosePanel,
  children,
}: {
  tabs?: ReactNode;
  tabActions?: ReactNode;
  breadcrumb?: ReactNode;
  mainClassName?: string;
  panel?: PanelConfig;
  panelOpen: boolean;
  isWide: boolean;
  onClosePanel: () => void;
  children: ReactNode;
}) {
  const body = (
    <main
      className={cn(
        /* h-full + flex column so single-child views (welcome composer,
           code editor, preview) can stretch to the full editor height
           even inside resizable panels, whose wrappers are plain blocks. */
        "flex h-full min-h-0 flex-1 flex-col",
        mainClassName ?? "overflow-y-auto"
      )}
    >
      {children}
    </main>
  );

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[#1f1f1f]">
      {/* tab strip */}
      <div className="flex h-[35px] shrink-0 items-stretch justify-between border-b border-[#2b2b2b] bg-[#181818]">
        <div className="flex min-w-0 items-stretch overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs}
        </div>
        {tabActions ? (
          <div className="hidden shrink-0 items-center gap-1.5 pr-2 sm:flex">{tabActions}</div>
        ) : null}
      </div>

      {breadcrumb}

      {panel && isWide ? (
        <PanelGroup direction="vertical" className="min-h-0 flex-1">
          <Panel defaultSize={panelOpen ? 68 : 100} minSize={20}>
            {body}
          </Panel>
          {panelOpen ? (
            <>
              <PanelResizeHandle className="relative h-px bg-[#2b2b2b] transition-colors focus-visible:outline-none data-[resize-handle-active]:bg-gold/50" />
              <BottomPanel
                tabs={panel.tabs}
                active={panel.active}
                onActive={panel.onActive}
                onClose={onClosePanel}
                height={panel.height}
              >
                {panel.content}
              </BottomPanel>
            </>
          ) : null}
        </PanelGroup>
      ) : (
        body
      )}
    </div>
  );
}

/**
 * Chrome-shaped loading skeleton — the IDE frame never "flashes away"
 * mid-navigation; used while a page hydrates / loads its workspace.
 */
export function IdeShellSkeleton({ hint = "Loading workspace…" }: { hint?: string }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#181818] text-zinc-200" aria-busy="true">
      {/* title bar */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[#2b2b2b] bg-[#181818] px-2">
        <BrandLogo size={15} withText={false} href={null} />
        <div className="flex items-center gap-1">
          {["File", "Edit", "Selection", "View", "Go", "Run"].map((m) => (
            <span key={m} className="rounded px-1.5 text-[12.5px] text-zinc-500">
              {m}
            </span>
          ))}
        </div>
        <div className="pointer-events-none flex min-w-0 flex-1 justify-center px-2">
          <div className="h-6.5 w-full max-w-[380px] rounded-md border border-white/[0.06] bg-white/[0.03]" />
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="size-4 rounded bg-white/[0.05]" />
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* activity bar */}
        <div className="hidden w-12 shrink-0 flex-col items-center gap-1 border-r border-[#2b2b2b] bg-[#181818] py-2 md:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="size-[22px] rounded bg-white/[0.05]" />
          ))}
        </div>
        {/* side bar */}
        <div className="hidden w-[240px] shrink-0 space-y-1.5 border-r border-[#2b2b2b] bg-[#181818] p-3 md:block">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-[18px] animate-pulse rounded bg-white/[0.05]" />
          ))}
        </div>
        {/* editor */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#1f1f1f]">
          <div className="flex h-[35px] shrink-0 items-center border-b border-[#2b2b2b] bg-[#181818] pl-3.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-white/[0.06]" />
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <span className="flex items-center gap-2.5 text-sm text-zinc-500">
              <span
                aria-hidden="true"
                className="size-1.5 animate-pulse rounded-full bg-gold"
              />
              {hint}
            </span>
          </div>
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
