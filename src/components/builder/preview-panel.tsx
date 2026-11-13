"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { RotatingLabel } from "@/components/builder/building-labels";
import type { ProjectDetail } from "@/lib/types";

export type BuilderTab = "preview" | "code";
export type DeviceMode = "desktop" | "mobile";

interface PreviewPanelProps {
  project: ProjectDetail;
  tab: BuilderTab;
  device: DeviceMode;
  previewKey: number;
  generating: boolean;
  onRefresh: () => void;
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="glass-panel flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
    >
      {children}
    </button>
  );
}

function CodeView({ html }: { html: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the code");
    }
  }

  return (
    <div className="relative h-full w-full">
      <button
        type="button"
        onClick={() => void copy()}
        disabled={!html}
        aria-label="Copy code"
        title="Copy code"
        className="glass-panel absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-400" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>

      {html ? (
        <pre className="h-full w-full overflow-auto p-4 font-mono text-xs leading-relaxed text-zinc-300">
          {html}
        </pre>
      ) : (
        <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Code appears after the first build.
        </div>
      )}
    </div>
  );
}

export function PreviewPanel({
  project,
  tab,
  device,
  previewKey,
  generating,
  onRefresh,
}: PreviewPanelProps) {
  function openInNewTab() {
    if (!project.html) return;
    // Allowed exception: a blob URL, not a network URL.
    const blob = new Blob([project.html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="relative h-full w-full bg-zinc-950/60">
      {/* Floating action strip — bottom-right so it never covers app content */}
      <div className="absolute bottom-3 right-3 z-10 flex gap-2">
        <IconBtn label="Refresh preview" onClick={onRefresh}>
          <RotateCw className="size-3.5" />
        </IconBtn>
        <IconBtn
          label="Open preview in new tab"
          onClick={openInNewTab}
          disabled={!project.html}
        >
          <ExternalLink className="size-3.5" />
        </IconBtn>
      </div>

      {tab === "preview" ? (
        project.html ? (
          <div className="relative h-full w-full">
            {generating ? (
              <>
                {/* Slim progress bar while re-generating with existing html */}
                <div className="absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse bg-gradient-to-r from-emerald-400 via-teal-500 to-lime-400" />
                <div className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-300">
                  <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
                  Updating…
                </div>
              </>
            ) : null}

            <div className="flex h-full justify-center overflow-hidden">
              <iframe
                key={`${project.version}-${previewKey}`}
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
                srcDoc={project.html}
                title="App preview"
                className="h-full w-full bg-white"
                style={
                  device === "mobile"
                    ? {
                        maxWidth: 390,
                        borderLeft: "1px solid rgba(255,255,255,0.08)",
                        borderRight: "1px solid rgba(255,255,255,0.08)",
                      }
                    : undefined
                }
              />
            </div>
          </div>
        ) : (
          /* Empty build state */
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
            <div aria-hidden className="absolute inset-0 bg-grid" />
            <div className="relative flex max-w-xs flex-col items-center gap-4 px-6 text-center">
              <div className="animate-glow flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-xl shadow-black/50">
                <Sparkles className="size-7 text-emerald-950" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold">
                  Your app is being crafted
                </p>
                <RotatingLabel className="mt-1 block text-sm text-muted-foreground" />
              </div>
            </div>
          </div>
        )
      ) : (
        <CodeView html={project.html} />
      )}
    </div>
  );
}
