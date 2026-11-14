"use client";

import type { ReactNode } from "react";
import { Bell as BellIcon, GitBranch, Rocket, XCircle, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The VS Code status bar — 22px strip on #181818, one gold "main" chip on
 * the left (the MONOLITH accent standing in for VS Code's blue remote
 * chip), quiet mono segments left and right.
 */
export function StatusBar({
  left,
  right,
  className,
  onOpenProblems,
}: {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  onOpenProblems?: () => void;
}) {
  return (
    <footer
      className={cn(
        "flex h-[22px] shrink-0 select-none items-center justify-between gap-3 border-t border-[#2b2b2b] bg-[#181818] text-[11.5px] leading-none text-zinc-400",
        className
      )}
      role="contentinfo"
      aria-label="Status bar"
    >
      <div className="flex h-full min-w-0 items-center">
        {/* branch indicator — the one accent chip */}
        <span className="flex h-full items-center gap-1.5 bg-gold px-2.5 font-medium text-black">
          <GitBranch className="size-3" aria-hidden="true" />
          main
        </span>
        {onOpenProblems ? (
          <button
            type="button"
            onClick={onOpenProblems}
            title="Problems"
            className="flex h-full items-center gap-2.5 px-2.5 transition-colors hover:bg-white/[0.07] hover:text-zinc-200"
          >
            <span className="flex items-center gap-1">
              <XCircle className="size-3" aria-hidden="true" />0
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="size-3" aria-hidden="true" />0
            </span>
          </button>
        ) : null}
        <div className="flex h-full min-w-0 items-center">{left}</div>
      </div>
      <div className="flex h-full items-center">{right}</div>
    </footer>
  );
}

/** A quiet status segment with optional gold pulse dot. */
export function StatusSegment({
  children,
  pulse = false,
  className,
  onClick,
  title,
}: {
  children: ReactNode;
  pulse?: boolean;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-full items-center gap-1.5 whitespace-nowrap px-2.5",
        onClick && "transition-colors hover:bg-white/[0.07] hover:text-zinc-200",
        className
      )}
    >
      {pulse ? (
        <span className="size-1.5 animate-pulse rounded-full bg-gold" aria-hidden="true" />
      ) : null}
      {children}
    </Tag>
  );
}

/** Right-side helper segments used by both pages. */
export function LnCol() {
  return <StatusSegment title="Cursor position">Ln 1, Col 1</StatusSegment>;
}

export function Encoding() {
  return (
    <>
      <StatusSegment className="hidden sm:flex" title="Indentation">
        Spaces: 2
      </StatusSegment>
      <StatusSegment className="hidden md:flex" title="Encoding">
        UTF-8
      </StatusSegment>
      <StatusSegment className="hidden md:flex" title="Line endings">
        LF
      </StatusSegment>
    </>
  );
}

export function GoLive({ onClick, live }: { onClick?: () => void; live?: boolean }) {
  if (!onClick) return null;
  return (
    <StatusSegment onClick={onClick} title={live ? "View live app" : "Publish and go live"}>
      <Rocket className="size-3" aria-hidden="true" />
      Go Live
    </StatusSegment>
  );
}

export function Bell() {
  return (
    <StatusSegment title="Notifications">
      <BellIcon className="size-3" aria-hidden="true" />
    </StatusSegment>
  );
}
