"use client";

/**
 * The VS Code title bar — menu row (File Edit Selection View Go Run ⋯),
 * centered workspace title pill, layout toggles and window controls.
 * Menus are real dropdowns; every item either acts or does not appear.
 */

import { type ReactNode, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Download,
  FolderUp,
  Globe,
  Menu as MenuIcon,
  MessageSquare,
  Minus,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Plus,
  Rocket,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Square,
  X,
  Files,
  GitBranch,
  Play,
  Blocks,
  Undo2,
  Redo2,
  ArrowLeft,
  ArrowRight,
  Command,
  MonitorSmartphone,
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
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface TitleBarMenuActions {
  onNewProject?: () => void;
  onImportFolder?: () => void;
  onImportFiles?: () => void;
  onDownload?: () => void;
  onPublish?: () => void;
  onOpenPreview?: () => void;
  onRefreshPreview?: () => void;
  onOpenPalette?: () => void;
  onFindInFiles?: () => void;
  /** Close the workspace (builder → dashboard). */
  onCloseWorkspace?: () => void;
}

function MenuButton({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-zinc-300 outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-white/[0.08]",
          wide ? "px-1.5" : ""
        )}
        aria-label={`${label} menu`}
        aria-haspopup="menu"
      >
        {label}
        {wide ? <ChevronDown className="size-3 text-zinc-500" aria-hidden="true" /> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-64 border-[#454545] bg-[#1f1f1f] text-zinc-200"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Item({
  icon,
  children,
  keys,
  onSelect,
  disabled,
}: {
  icon?: ReactNode;
  children: ReactNode;
  keys?: string;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  if (!onSelect) return null;
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      disabled={disabled}
      className="gap-2.5 text-[12.5px] data-[highlighted]:bg-white/[0.08] data-[disabled]:opacity-40"
    >
      <span className="flex size-4 items-center justify-center text-zinc-400" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      {keys ? (
        <kbd className="font-mono text-[10px] text-zinc-500">{keys}</kbd>
      ) : null}
    </DropdownMenuItem>
  );
}

function Sep() {
  return <DropdownMenuSeparator className="bg-white/[0.08]" />;
}

/** One layout-toggle / window-control square. */
function Square30({
  label,
  onClick,
  children,
  active,
  hideOnMobile,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  active?: boolean;
  hideOnMobile?: boolean;
}) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring",
        active ? "bg-white/[0.1] text-foreground" : "text-zinc-400 hover:bg-white/[0.08] hover:text-foreground",
        hideOnMobile && "hidden lg:inline-flex"
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar({
  title,
  menu,
  sidebarOpen,
  onToggleSidebar,
  onOpenDrawer,
  panelOpen,
  onTogglePanel,
  chatAvailable,
  chatOpen,
  onToggleChat,
  activeView,
  onOpenView,
  actions,
}: {
  /** Center pill text — project name or workspace. */
  title: string;
  menu: TitleBarMenuActions;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  /** Mobile hamburger — opens the explorer drawer. */
  onOpenDrawer: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  chatAvailable: boolean;
  chatOpen: boolean;
  onToggleChat: () => void;
  activeView: "explorer" | "search" | "scm" | "debug" | "extensions";
  onOpenView: (v: "explorer" | "search" | "scm" | "debug" | "extensions") => void;
  /** Extra right-side actions (Publish chip, etc.) */
  actions?: ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const initial = (user?.email?.trim()?.[0] ?? "?").toUpperCase();

  const selectAll = useMemo(
    () => () => {
      try {
        window.getSelection()?.selectAllChildren(document.body);
      } catch {
        /* nothing selectable */
      }
    },
    []
  );

  function handleSignOut() {
    clear();
    router.replace("/");
  }

  const find = () => (menu.onFindInFiles ? menu.onFindInFiles() : menu.onOpenPalette?.());

  return (
    <header
      className="flex h-9 shrink-0 items-center gap-1 border-b border-[#2b2b2b] bg-[#181818] pl-2 pr-1.5 select-none"
      role="banner"
      aria-label="Title bar"
    >
      {/* mobile drawer trigger */}
      <button
        type="button"
        aria-label="Open explorer menu"
        onClick={onOpenDrawer}
        className="inline-flex size-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-foreground md:hidden"
      >
        <MenuIcon className="size-4" aria-hidden="true" />
      </button>

      {/* logo + menus */}
      <Link
        href="/dashboard"
        aria-label="Lovify home"
        className="mr-1 hidden shrink-0 items-center rounded outline-none focus-visible:ring-1 focus-visible:ring-ring sm:flex"
      >
        <BrandLogo size={15} withText={false} href={null} />
      </Link>

      <nav aria-label="Application menu" className="hidden items-center md:flex">
        <MenuButton label="File">
          <Item icon={<Plus />} keys="⌘N" onSelect={menu.onNewProject}>
            New Project…
          </Item>
          <Item icon={<FolderUp />} onSelect={menu.onImportFolder}>
            Import Folder…
          </Item>
          <Item icon={<FolderUp />} onSelect={menu.onImportFiles}>
            Import Files…
          </Item>
          <Sep />
          <Item icon={<Download />} keys="⌘S" onSelect={menu.onDownload}>
            Download App
          </Item>
          <Item icon={<Rocket />} onSelect={menu.onPublish}>
            Publish App
          </Item>
          <Sep />
          <Item icon={<X />} onSelect={menu.onCloseWorkspace}>
            Close Workspace
          </Item>
        </MenuButton>

        <MenuButton label="Edit">
          <Item icon={<Undo2 />} onSelect={() => toastInfo("Lovify edits are versioned — restore any version from Timeline.")}>
            Undo
          </Item>
          <Item icon={<Redo2 />} onSelect={() => toastInfo("Lovify edits are versioned — restore any version from Timeline.")}>
            Redo
          </Item>
          <Sep />
          <Item icon={<Search />} keys="⌘F" onSelect={find}>
            Find in Workspace
          </Item>
          <Item icon={<Command />} keys="⌘K" onSelect={menu.onOpenPalette}>
            Command Palette
          </Item>
        </MenuButton>

        <MenuButton label="Selection">
          <Item icon={<Square className="size-3" />} onSelect={selectAll}>
            Select All
          </Item>
        </MenuButton>

        <MenuButton label="View">
          <Item icon={<Files />} keys="⇧⌘E" onSelect={() => onOpenView("explorer")}>
            Explorer
          </Item>
          <Item icon={<Search />} keys="⇧⌘F" onSelect={() => onOpenView("search")}>
            Search
          </Item>
          <Item icon={<GitBranch />} onSelect={() => onOpenView("scm")}>
            Source Control
          </Item>
          <Sep />
          <Item icon={<PanelLeft />} keys="⌘B" onSelect={onToggleSidebar}>
            Toggle Side Bar
          </Item>
          <Item icon={<PanelBottom />} keys="⌘J" onSelect={onTogglePanel}>
            Toggle Panel
          </Item>
          {chatAvailable ? (
            <Item icon={<MessageSquare />} keys="⌘L" onSelect={onToggleChat}>
              Toggle AI Chat
            </Item>
          ) : null}
        </MenuButton>

        <MenuButton label="Go">
          <Item icon={<ArrowLeft />} onSelect={() => router.back()}>
            Back
          </Item>
          <Item icon={<ArrowRight />} onSelect={() => router.forward()}>
            Forward
          </Item>
          <Sep />
          <Item icon={<Files />} onSelect={() => router.push("/dashboard")}>
            Workspace
          </Item>
          <Item icon={<Blocks />} onSelect={() => router.push("/explore")}>
            Explore Gallery
          </Item>
          <Item icon={<Settings />} onSelect={() => router.push("/settings")}>
            Settings
          </Item>
        </MenuButton>

        <MenuButton label="Run">
          <Item icon={<Play />} keys="⌘⏎" onSelect={menu.onOpenPreview}>
            Open Preview
          </Item>
          <Item icon={<RefreshCw />} onSelect={menu.onRefreshPreview}>
            Refresh Preview
          </Item>
          <Sep />
          <Item icon={<Globe />} onSelect={menu.onPublish}>
            Go Live
          </Item>
        </MenuButton>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-7 items-center justify-center rounded-md text-zinc-400 outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-white/[0.08]"
            aria-label="More menus"
          >
            <span className="text-base leading-none">⋯</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="w-56 border-[#454545] bg-[#1f1f1f] text-zinc-200"
          >
            <Item icon={<MonitorSmartphone />} onSelect={() => router.push("/explore")}>
              Published Apps
            </Item>
            <Item icon={<Sparkles />} onSelect={() => router.push("/chat")}>
              Lovify Chat
            </Item>
            <Sep />
            <Item icon={<Settings />} onSelect={() => router.push("/settings")}>
              Settings
            </Item>
            <Item icon={<X />} onSelect={handleSignOut}>
              Sign out
            </Item>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* centered title pill */}
      <div className="pointer-events-none flex min-w-0 flex-1 justify-center px-2">
        <div className="flex h-6.5 w-full max-w-[380px] items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.03] px-3 lg:max-w-[460px]">
          <span className="truncate text-xs text-zinc-300" title={title}>
            {title}
          </span>
        </div>
      </div>

      {/* right cluster */}
      <div className="flex shrink-0 items-center gap-0.5">
        {actions}
        <div className="hidden items-center gap-0.5 lg:flex">
          <Square30 label="Toggle primary side bar (⌘B)" onClick={onToggleSidebar} active={sidebarOpen}>
            <PanelLeft className="size-4" />
          </Square30>
          <Square30 label="Toggle panel (⌘J)" onClick={onTogglePanel} active={panelOpen}>
            <PanelBottom className="size-4" />
          </Square30>
          {chatAvailable ? (
            <Square30 label="Toggle AI chat (⌘L)" onClick={onToggleChat} active={chatOpen}>
              <PanelRight className="size-4" />
            </Square30>
          ) : null}
        </div>

        {/* account */}
        <div className="ml-1 flex items-center gap-0.5 lg:ml-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="rounded-full outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Avatar className="size-5.5 border border-white/15">
                <AvatarFallback className="bg-white/[0.08] text-[9px] font-semibold text-zinc-200">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border-[#454545] bg-[#1f1f1f] text-zinc-200">
              <DropdownMenuLabel className="font-normal">
                <span className="sr-only">Signed in as</span>
                <span className="block truncate font-mono text-[10px] text-zinc-500">
                  {user?.email ?? "Signed in"}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem
                className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
                onSelect={() => router.push("/settings")}
              >
                <Settings className="size-3.5" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 text-[12.5px] data-[highlighted]:bg-white/[0.08]"
                onSelect={handleSignOut}
              >
                <X className="size-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* window controls */}
          <div className="hidden items-center sm:flex">
            <span className="mx-1 h-4 w-px bg-white/[0.08]" aria-hidden="true" />
            <Square30 label="Minimize panel" onClick={onTogglePanel} hideOnMobile>
              <Minus className="size-3.5" />
            </Square30>
            <Square30
              label="Toggle full screen"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else void document.documentElement.requestFullscreen?.();
              }}
              hideOnMobile
            >
              <Square className="size-3" />
            </Square30>
            <Square30 label="Close workspace" onClick={menu.onCloseWorkspace} hideOnMobile>
              <X className="size-4" />
            </Square30>
          </div>
        </div>
      </div>
    </header>
  );
}

function toastInfo(message: string) {
  toast(message, { duration: 3500 });
}
