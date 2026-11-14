"use client";

import type { ReactNode } from "react";
import { GitBranch } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * VS Code-style status bar — the signature bottom strip of the IDE shell.
 * Flat onyx surface, mono micro-type, one gold "main" chip on the left
 * (the only accent, per MONOLITH).
 */
export function StatusBar({
  left,
  right,
  className,
}: {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <footer
      className={cn(
        "flex h-6 shrink-0 select-none items-center justify-between gap-3 border-t border-white/[0.06] bg-[oklch(0.145_0_0)] px-1.5 font-mono text-[10.5px] leading-none text-zinc-400",
        className
      )}
      role="contentinfo"
      aria-label="Status bar"
    >
      <div className="flex h-full min-w-0 items-center">
        {/* remote/branch indicator — the accent chip */}
        <span className="flex h-full items-center gap-1 bg-gold px-2 font-semibold text-black">
          <GitBranch className="size-3" aria-hidden="true" />
          main
        </span>
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
}: {
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-full items-center gap-1.5 px-2.5 whitespace-nowrap",
        className
      )}
    >
      {pulse ? (
        <span className="size-1.5 animate-pulse rounded-full bg-gold" aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}
