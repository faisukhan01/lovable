"use client";

/**
 * The VS Code activity bar — Explorer, Search, Source Control,
 * Run and Debug, Extensions on top; account and settings at the bottom.
 * The active view carries a gold left indicator (MONOLITH accent).
 */

import {
  Blocks,
  Bug,
  Files,
  GitBranch,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SideView } from "@/components/ide/view-types";
const TOP_ITEMS: { id: SideView; label: string; icon: typeof Files }[] = [
  { id: "explorer", label: "Explorer (⇧⌘E)", icon: Files },
  { id: "search", label: "Search (⇧⌘F)", icon: Search },
  { id: "scm", label: "Source Control", icon: GitBranch },
  { id: "debug", label: "Run and Debug", icon: Bug },
  { id: "extensions", label: "Extensions", icon: Blocks },
];

export function ActivityBar({
  activeView,
  onSelect,
  badges,
  settingsHref = "/settings",
}: {
  activeView: SideView | null;
  /** Clicking the active view again closes the side bar (VS Code behavior). */
  onSelect: (view: SideView) => void;
  /** Small count badges (e.g. source-control changes). */
  badges?: Partial<Record<SideView, number>>;
  settingsHref?: string;
}) {
  return (
    <nav
      aria-label="Activity bar"
      className="hidden w-12 shrink-0 flex-col items-center justify-between border-r border-[#2b2b2b] bg-[#181818] py-1.5 md:flex"
    >
      <div className="flex flex-col items-center">
        {TOP_ITEMS.map((item) => {
          const active = activeView === item.id;
          const badge = badges?.[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-label={item.label}
              title={item.label}
              aria-pressed={active}
              className={cn(
                "relative flex h-12 w-12 items-center justify-center outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
                active
                  ? "text-foreground"
                  : "text-zinc-500 hover:text-zinc-200"
              )}
            >
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-gold"
                />
              ) : null}
              <item.icon className="size-[22px]" strokeWidth={1.7} aria-hidden="true" />
              {badge && badge > 0 ? (
                <span className="absolute bottom-2.5 right-2.5 flex min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-semibold leading-4 text-black">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center">
        <a
          href={settingsHref}
          aria-label="Settings"
          title="Settings"
          className="flex h-12 w-12 items-center justify-center text-zinc-500 outline-none transition-colors hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <Settings className="size-[22px]" strokeWidth={1.7} aria-hidden="true" />
        </a>
      </div>
    </nav>
  );
}
