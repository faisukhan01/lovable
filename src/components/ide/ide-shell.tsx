"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  Files,
  MessageSquare,
  PanelLeft,
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

/**
 * The Lovify IDE shell — a VS Code / Cursor style workspace frame.
 *
 *  ┌───────────────────── title bar (command center) ─────────────────────┐
 *  │ act │ side bar │  tab strip                                          │
 *  │ bar │ explorer │  editor area (children)                             │
 *  └───────────────────────── status bar ─────────────────────────────────┘
 *
 * The shell owns chrome only: sidebar toggle (⌘B), mobile drawer, the
 * account menu and the status bar. Pages compose their own sidebar / tabs /
 * editor content.
 */
export function IdeShell({
  sidebar,
  tabs,
  breadcrumb,
  statusLeft,
  statusRight,
  onOpenPalette,
  onNewProject,
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
  children: ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  /* Sidebar preference — the shell only mounts client-side (the dashboard
     gates on auth hydration), so reading localStorage lazily is safe and
     needs no effect. */
  const [sidebarOpen, setSidebarOpen] = useState(
    () =>
      typeof window === "undefined" ||
      window.localStorage.getItem(SIDEBAR_KEY) !== "closed"
  );
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile overlay

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => {
      const next = !v;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "open" : "closed");
      return next;
    });
  }, []);

  /* ⌘/Ctrl + B toggles the side bar — VS Code muscle memory. Escape closes
     the mobile explorer drawer. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  const initial = (user?.email?.trim()?.[0] ?? "?").toUpperCase();

  function handleSignOut() {
    clear();
    router.replace("/");
  }

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
            <ActivityButton label="Lovify Chat" href="/chat">
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
            >
              <div className="flex min-h-0 flex-1 flex-col">{sidebar}</div>
            </aside>
          </>
        ) : null}

        {/* editor column */}
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          {/* tab strip */}
          <div className="flex h-9 shrink-0 items-stretch justify-between border-b border-white/[0.06] bg-[oklch(0.11_0_0)]">
            <div className="flex min-w-0 items-stretch">{tabs}</div>
            {breadcrumb ? (
              <div className="hidden items-center pr-3 font-mono text-[10.5px] text-muted-foreground/70 lg:flex">
                {breadcrumb}
              </div>
            ) : null}
          </div>

          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>

      <StatusBar left={statusLeft} right={statusRight} />
    </div>
  );
}

/** One icon in the activity bar, with the VS Code gold active indicator. */
function ActivityButton({
  label,
  active = false,
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
    <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={onClick} className={className}>
      {indicator}
      {children}
    </button>
  );
}
