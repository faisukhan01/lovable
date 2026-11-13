"use client";

import { useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Lightbulb,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { RotatingLabel } from "@/components/builder/building-labels";
import type { ProjectDetail } from "@/lib/types";

export type BuilderTab = "preview" | "code" | "diff";
export type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTH: Record<DeviceMode, number | null> = {
  desktop: null,
  tablet: 768,
  mobile: 390,
};

interface PreviewPanelProps {
  project: ProjectDetail;
  tab: BuilderTab;
  device: DeviceMode;
  previewKey: number;
  generating: boolean;
  onRefresh: () => void;
  onDownload: () => void;
  onExplain: () => void;
  children?: React.ReactNode; // diff slot
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

function CodeView({
  html,
  onDownload,
  onExplain,
}: {
  html: string | null;
  onDownload: () => void;
  onExplain: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const lineCount = useMemo(() => (html ? html.split("\n").length : 0), [html]);

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
      {/* action strip */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        {html ? (
          <span className="glass-panel hidden rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:inline-flex">
            {lineCount} lines
          </span>
        ) : null}
        <IconBtn label="Explain this code with Z.AI" onClick={onExplain} disabled={!html}>
          <Lightbulb className="size-3.5" />
        </IconBtn>
        <IconBtn label="Download HTML" onClick={onDownload} disabled={!html}>
          <Download className="size-3.5" />
        </IconBtn>
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!html}
          aria-label="Copy code"
          title="Copy code"
          className="glass-panel flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
        >
          {copied ? (
            <Check className="size-3.5 text-gold" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>

      {html ? (
        <SyntaxHighlighter
          language="html"
          style={oneDark}
          showLineNumbers
          wrapLongLines={false}
          customStyle={{
            margin: 0,
            height: "100%",
            width: "100%",
            borderRadius: 0,
            background: "transparent",
            fontSize: 12,
            padding: "2.75rem 1rem 1rem 0.5rem",
          }}
          codeTagProps={{ style: { fontFamily: "var(--font-geist-mono), monospace" } }}
          lineNumberStyle={{ minWidth: "2.5em", color: "rgba(255,255,255,0.18)" }}
        >
          {html}
        </SyntaxHighlighter>
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
  onDownload,
  onExplain,
  children,
}: PreviewPanelProps) {
  function openInNewTab() {
    if (!project.html) return;
    // Allowed exception: a blob URL, not a network URL.
    const blob = new Blob([project.html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
  }

  const deviceWidth = DEVICE_WIDTH[device];

  return (
    <div className="relative h-full w-full bg-zinc-950/60">
      {/* Floating action strip — bottom-right so it never covers app content */}
      {tab === "preview" ? (
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
      ) : null}

      {tab === "diff" ? (
        <div className="h-full w-full">{children}</div>
      ) : tab === "code" ? (
        <CodeView html={project.html} onDownload={onDownload} onExplain={onExplain} />
      ) : project.html ? (
        <div className="relative h-full w-full">
          {generating ? (
            <>
              {/* Slim progress bar while re-generating with existing html */}
              <div className="absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse bg-gold/80" />
              <div className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-gold">
                <span className="size-1.5 animate-pulse rounded-full bg-gold" />
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
                deviceWidth
                  ? {
                      maxWidth: deviceWidth,
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
            <div className="flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <Sparkles className="size-7 text-gold" />
            </div>
            <div>
              <p className="font-display text-xl tracking-normal">
                Your app is being crafted
              </p>
              <RotatingLabel className="mt-1 block text-sm text-muted-foreground" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
