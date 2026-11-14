"use client";

/**
 * The editor chrome — VS Code file tabs, breadcrumbs and a real code
 * editor surface: separate line-number gutter, Dark+ syntax colors and
 * a clickable minimap. The preview iframe and diff viewer slot into the
 * same frame so everything reads as one editor.
 */

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  Braces,
  ChevronRight,
  FileCode2,
  FileText,
  GitCompareArrows,
  Monitor,
  X,
} from "lucide-react";

import { darkPlus } from "@/lib/prism-dark-plus";
import type { VFile } from "@/lib/project-files";
import { cn } from "@/lib/utils";

/* ------------------------------ file icons ------------------------------ */

export function FileIcon({ lang, className }: { lang: VFile["lang"]; className?: string }) {
  const cls = cn("size-3.5 shrink-0", className);
  if (lang === "html") return <FileCode2 className={cn(cls, "text-[#E37933]")} aria-hidden="true" />;
  if (lang === "css") return <Braces className={cn(cls, "text-[#519ABA]")} aria-hidden="true" />;
  if (lang === "javascript") return <FileCode2 className={cn(cls, "text-[#E8D44D]")} aria-hidden="true" />;
  if (lang === "diff") return <GitCompareArrows className={cn(cls, "text-zinc-400")} aria-hidden="true" />;
  return <FileText className={cn(cls, "text-zinc-400")} aria-hidden="true" />;
}

/* --------------------------------- tabs --------------------------------- */

export function IdeTab({
  active,
  onClick,
  onClose,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  onClose?: () => void;
  icon: ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <div
      role="tab"
      aria-selected={active}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
      title={hint ?? label}
      className={cn(
        "group flex h-[35px] shrink-0 cursor-pointer items-center gap-1.5 border-r border-[#2b2b2b] border-t-[1.5px] pl-3 pr-2 text-[12.5px] outline-none transition-colors",
        active
          ? "border-t-gold bg-[#1f1f1f] text-foreground"
          : "border-t-transparent bg-[#181818] text-zinc-500 hover:bg-[#1d1d1d] hover:text-zinc-300"
      )}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
      {onClose ? (
        <button
          type="button"
          aria-label={`Close ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 inline-flex size-4 items-center justify-center rounded text-zinc-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[open]:opacity-100"
          data-open={active ? "true" : undefined}
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------ breadcrumbs ----------------------------- */

export function Breadcrumbs({ trail }: { trail: { label: string; lang?: VFile["lang"] }[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden h-[22px] shrink-0 items-center gap-0.5 overflow-x-auto border-b border-transparent bg-[#1f1f1f] px-4 text-[11.5px] text-zinc-500 [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden"
    >
      {trail.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-0.5 whitespace-nowrap">
          {i > 0 ? <ChevronRight className="size-3 text-zinc-600" aria-hidden="true" /> : null}
          {item.lang ? <FileIcon lang={item.lang} className="size-3" /> : null}
          <span className={i === trail.length - 1 ? "text-zinc-400" : undefined}>{item.label}</span>
        </span>
      ))}
    </nav>
  );
}

/* ------------------------------ code editor ----------------------------- */

const LANG_MAP: Record<VFile["lang"], string> = {
  html: "html",
  css: "css",
  javascript: "javascript",
  markdown: "markdown",
  diff: "diff",
};

export function CodeEditor({ file }: { file: VFile | null }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => (file ? file.content.split("\n") : []), [file]);

  if (!file || !file.content.trim()) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1f1f1f] px-6 text-center text-sm text-zinc-500">
        {file ? `${file.label} is empty.` : "Code appears after the first build."}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-[#1f1f1f]">
      {/* scroll area: gutter (sticky left) + code */}
      <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-auto">
        <div className="flex min-h-full w-max min-w-full">
          {/* gutter */}
          <div
            aria-hidden="true"
            className="sticky left-0 z-10 shrink-0 select-none bg-[#1f1f1f] pr-3 pl-4 text-right font-mono text-[12.5px] leading-[20px] text-[#6E7681]"
            style={{ paddingTop: 12, paddingBottom: 12 }}
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          <SyntaxHighlighter
            language={LANG_MAP[file.lang] ?? "markdown"}
            style={darkPlus}
            showLineNumbers={false}
            wrapLongLines={false}
            customStyle={{
              margin: 0,
              background: "transparent",
              fontSize: "12.5px",
              lineHeight: "20px",
              padding: "12px 24px 12px 4px",
              width: "max-content",
              minWidth: "100%",
            }}
            codeTagProps={{
              style: {
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                whiteSpace: "pre",
              },
            }}
          >
            {file.content}
          </SyntaxHighlighter>
        </div>
      </div>

      {/* minimap (fixed column) */}
      <MinimapColumn
        content={file.content}
        onSeek={(ratio) => {
          const el = scrollRef.current;
          if (!el) return;
          el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
        }}
      />
    </div>
  );
}

function MinimapColumn({ content, onSeek }: { content: string; onSeek: (r: number) => void }) {
  return (
    <div
      aria-hidden="true"
      className="relative hidden w-[72px] shrink-0 cursor-pointer overflow-hidden border-l border-[#2b2b2b]/40 bg-[#1f1f1f] xl:block"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek(Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)));
      }}
    >
      <MinimapCanvas content={content} />
    </div>
  );
}

function MinimapCanvas({ content }: { content: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = 64;
    const lines = content.split("\n");
    const rowH = 2.2;
    const h = Math.min(lines.length * rowH, 2200);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = "64px";
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const maxLen = 100;
    lines.forEach((line, i) => {
      if (i * rowH > h) return;
      const trimmed = line.trimStart();
      if (!trimmed) return;
      const indent = line.length - trimmed.length;
      const len = Math.min(trimmed.length, maxLen);
      const x = Math.min(indent * 1.1, 18) + 4;
      const barW = Math.max((len / maxLen) * (w - x - 2), 2);
      ctx.fillStyle = "rgba(160, 160, 160, 0.62)";
      ctx.fillRect(x, i * rowH, barW, 1.3);
    });
  }, [content]);
  return <canvas ref={canvasRef} />;
}

/* --------------------------- empty editor state -------------------------- */

export function EmptyEditor({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-[#1f1f1f] px-6">
      <div className="flex max-w-xs flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
          {icon ?? <Monitor className="size-6 text-gold" aria-hidden="true" />}
        </div>
        <p className="font-display text-lg tracking-normal text-zinc-200">{title}</p>
        {hint ? <p className="text-xs leading-relaxed text-zinc-500">{hint}</p> : null}
      </div>
    </div>
  );
}
