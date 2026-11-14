"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  Compass,
  Files,
  MessageSquare,
  PanelLeft,
  PanelRight,
  Search,
  Settings,
  Menu,
  X,
  Sparkles,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBar } from "@/components/ide/status-bar";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "lovify:ide-sidebar";
const CHAT_KEY = "lovify:ide-chat";

/**
 * The Lovify IDE shell — a VS Code / Cursor style workspace frame.
 *
 *  ┌───────────────────── title bar (command center) ─────────────────────┐
 *  │ act │ side bar │  tab strip              │  AI chat (Cursor style)   │
 *  │ bar │ explorer │  editor area (children) │  (right dock, ⌘L)         │
 *  └───────────────────────── status bar ─────────────────────────────────┘
 *
 * The shell owns chrome only: sidebar toggle (⌘B), AI-chat dock (⌘L),
 * mobile drawer, the account menu and the status bar. Pages compose their
 * own sidebar / tabs / editor content.
 */
export function IdeShell({
  sidebar,
  tabs,
  breadcrumb,
  statusLeft,
  statusRight,
  onOpenPalette,
  onNewProject,
  /** Right-dock content (the Cursor AI chat). Desktop layout only. */
  chat,
  /** Whether the right dock is open (defaults to the user's last choice). */
  chatOpen,
  /** Toggles the right dock; also wires the activity-bar chat icon. */
  onToggleChat,
  /** Extra per-page actions rendered in the title bar (e.g. Publish). */
  actions,
  /** Override the editor main element classes (e.g. overflow-hidden). */
  mainClassName,
  children,
}: {
  /** Explorer content rendered in the side bar. */
  sidebar: ReactNode;
  /** Editor tab strip content (a single "Welcome" tab on the dashboard). */
  tabs?: ReactNode;
  /** Breadcrumb hint rendered after the tabs (desktop only). */
  breadcrumb?: ReactNode;
  statusLeft?: ReactNode;
  statusRight?: ReactNode;
  onOpenPalette?: () => void;
  onNewProject?: () => void;
  chat?: ReactNode;
  chatOpen?: boolean;
  onToggleChat?: () => void;
  actions?: ReactNode;
  mainClassName?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  /* Panel preferences — the shell only mounts client-side (pages gate on
     auth hydration), so reading localStorage lazily is safe. */
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
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile overlay

  const chatVisible = chat !== undefined && (chatOpen ?? dockOpen);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => {
      const next = !v;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "open" : "closed");
      return next;
    });
  }, []);

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

  /* ⌘/Ctrl + B toggles the side bar, ⌘/Ctrl + L the AI chat dock —
     VS Code / Cursor muscle memory. Escape closes the mobile drawer. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "l" &&
        chat !== undefined
      ) {
        e.preventDefault();
        toggleChat();
        return;
      }
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar, toggleChat, chat]);

  const initial = (user?.email?.trim()?.[0] ?? "?").toUpperCase();

  function handleSignOut() {
    clear();
    router.replace("/");
  }

  const editorColumn = (
    <EditorColumn
      tabs={tabs}
      breadcrumb={breadcrumb}
      mainClassName={mainClassName}
      className={chat !== undefined ? "h-full" : undefined}
    >
      {children}
    </EditorColumn>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* ------------------------------ title bar ------------------------------ */}
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[oklch(0.125_0_0)] px-2">
        {/* mobile menu */}
        <button
          type="button"
          aria-label={drawerOpen ? "Close explorer" : "Open explorer"}
          onClick={() => setDrawerOpen((v) => !v)}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground md:hidden"
        >
          {drawerOpen ? (
            <X className="size-4" aria-hidden="true" />
          ) : (
            <Menu className="size-4" aria-hidden="true" />
          )}
        </button>

        <Link
          href="/dashboard"
          aria-label="Lovify dashboard"
          className="flex items-center gap-2 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo size={16} withText={false} href={null} />
          <span className="font-display text-sm leading-none text-foreground">
            Lovify
          </span>
        </Link>
        <span className="hidden rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:inline-block">
          workspace
        </span>

        {/* command center */}
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Open command palette"
            className="flex h-6.5 w-full items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 text-left text-xs text-muted-foreground transition-colors hover:border-white/[0.16] hover:text-foreground"
          >
            <Search className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">Search apps and commands…</span>
            <kbd className="ml-auto hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-px font-mono text-[9px] sm:inline-block">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* per-page actions (e.g. Publish) */}
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label={sidebarOpen ? "Hide explorer" : "Show explorer"}
            aria-pressed={sidebarOpen}
            title="Toggle side bar (⌘B)"
            onClick={toggleSidebar}
            className="hidden size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground md:inline-flex"
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </button>
          {chat !== undefined ? (
            <button
              type="button"
              aria-label={chatVisible ? "Hide AI chat" : "Show AI chat"}
              aria-pressed={chatVisible}
              title="Toggle AI chat (⌘L)"
              onClick={toggleChat}
              className="hidden size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground md:inline-flex"
            >
              <PanelRight className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          {onNewProject ? (
            <button
              type="button"
              aria-label="New project"
              title="New project"
              onClick={onNewProject}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            >
              <Sparkles className="size-4" aria-hidden="true" />
            </button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="size-5.5 border border-white/10">
                  <AvatarFallback className="bg-white/[0.08] text-[10px] font-semibold text-foreground">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <span className="sr-only">Signed in as</span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  {user?.email ?? "Signed in"}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <X />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* --------------------------------- body --------------------------------- */}
      <div className="flex min-h-0 flex-1">
        {/* activity bar */}
        <nav
          aria-label="Activity bar"
          className="hidden w-11 shrink-0 flex-col items-center justify-between border-r border-white/[0.06] bg-[oklch(0.11_0_0)] py-2 md:flex"
        >
          <div className="flex flex-col items-center gap-1">
            <ActivityButton
              label="Explorer"
              active={sidebarOpen}
              onClick={toggleSidebar}
            >
              <Files className="size-4.5" />
            </ActivityButton>
            <ActivityButton label="Search" onClick={onOpenPalette}>
              <Search className="size-4.5" />
            </ActivityButton>
            <ActivityButton
              label="Lovify AI chat"
              active={chat !== undefined ? chatVisible : undefined}
              onClick={chat !== undefined ? toggleChat : undefined}
              href={chat === undefined ? "/chat" : undefined}
            >
              <MessageSquare className="size-4.5" />
            </ActivityButton>
            <ActivityButton label="Explore gallery" href="/explore">
              <Compass className="size-4.5" />
            </ActivityButton>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ActivityButton label="Settings" href="/settings">
              <Settings className="size-4.5" />
            </ActivityButton>
          </div>
        </nav>

        {/* side bar — desktop */}
        {sidebarOpen ? (
          <aside
            aria-label="Explorer"
            className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-[oklch(0.125_0_0)] md:flex"
          >
            {sidebar}
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
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-white/[0.06] bg-[oklch(0.125_0_0)] pt-11 md:hidden"
              onClickCapture={(e) => {
                /* tapping any actionable row navigates → dismiss the drawer */
                const t = e.target as HTMLElement;
                if (t.closest("button, a")) setDrawerOpen(false);
              }}
            >
              <div className="flex min-h-0 flex-1 flex-col">{sidebar}</div>
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
                <PanelResizeHandle className="relative w-px bg-white/[0.06] transition-colors after:absolute after:inset-y-0 after:left-1/2 after:z-10 after:w-1.5 after:-translate-x-1/2 focus-visible:outline-none data-[resize-handle-active]:bg-gold/50" />
                <Panel
                  defaultSize={34}
                  minSize={22}
                  className="bg-[oklch(0.135_0_0)]"
                >
                  {chat}
                </Panel>
              </>
            ) : null}
          </PanelGroup>
        ) : (
          editorColumn
        )}
      </div>

      <StatusBar left={statusLeft} right={statusRight} />
    </div>
  );
}

/** Tab strip + editor main. Sits inside a resizable panel in builder mode. */
function EditorColumn({
  tabs,
  breadcrumb,
  mainClassName,
  className,
  children,
}: {
  tabs?: ReactNode;
  breadcrumb?: ReactNode;
  mainClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col bg-background",
        className
      )}
    >
      {/* tab strip */}
      <div className="flex h-9 shrink-0 items-stretch justify-between border-b border-white/[0.06] bg-[oklch(0.11_0_0)]">
        <div className="flex min-w-0 items-stretch overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs}
        </div>
        {breadcrumb ? (
          <div className="hidden items-center pr-3 font-mono text-[10.5px] text-muted-foreground/70 lg:flex">
            {breadcrumb}
          </div>
        ) : null}
      </div>

      <main
        className={cn("min-h-0 flex-1", mainClassName ?? "overflow-y-auto")}
      >
        {children}
      </main>
    </div>
  );
}

/** One icon in the activity bar, with the VS Code gold active indicator. */
function ActivityButton({
  label,
  active,
  onClick,
  href,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const className = cn(
    "relative inline-flex size-8 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "text-foreground"
      : "text-muted-foreground hover:text-foreground"
  );

  const indicator = active ? (
    <span
      aria-hidden="true"
      className="absolute left-[-8px] top-1/2 h-4 w-0.5 -translate-y-1/2 bg-gold"
    />
  ) : null;

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={className}>
        {indicator}
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={className}
    >
      {indicator}
      {children}
    </button>
  );
}

/**
 * Chrome-shaped loading skeleton — used while a page hydrates / loads its
 * workspace so the IDE frame never "flashes away" mid-navigation.
 */
export function IdeShellSkeleton({ hint = "Loading workspace…" }: { hint?: string }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background" aria-busy="true">
      {/* title bar */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[oklch(0.125_0_0)] px-2">
        <BrandLogo size={16} withText={false} href={null} />
        <span className="font-display text-sm leading-none text-foreground">
          Lovify
        </span>
        <span className="hidden rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:inline-block">
          workspace
        </span>
        <div className="mx-auto h-6.5 w-full max-w-md rounded-md border border-white/[0.08] bg-white/[0.03]" />
        <div className="size-5.5 rounded-full border border-white/10 bg-white/[0.06]" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* activity bar */}
        <div className="hidden w-11 shrink-0 flex-col items-center gap-1 border-r border-white/[0.06] bg-[oklch(0.11_0_0)] py-2 md:flex">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="size-8 rounded-md bg-white/[0.04]" />
          ))}
        </div>
        {/* explorer */}
        <div className="hidden w-64 shrink-0 space-y-1.5 border-r border-white/[0.06] bg-[oklch(0.125_0_0)] p-3 md:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-white/[0.05]" />
          ))}
        </div>
        {/* editor */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center border-b border-white/[0.06] bg-[oklch(0.11_0_0)] px-3.5">
            <div className="h-3.5 w-20 animate-pulse rounded bg-white/[0.06]" />
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <span className="flex items-center gap-2.5 text-sm text-muted-foreground">
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
