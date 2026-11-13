"use client";

/**
 * Version diff viewer — Claude Code style line-level diff between two
 * versions of the generated app. Additions glow champagne-gold, deletions
 * wash rose. Pure client-side LCS diff, no dependencies.
 */

import { useMemo } from "react";
import { GitCompareArrows, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_LINES = 2000;

type DiffOp = { kind: "same" | "add" | "del"; text: string };

/** Classic LCS line diff with common prefix/suffix fast paths. */
export function diffLines(aRaw: string, bRaw: string): DiffOp[] {
  const a = aRaw.split("\n").slice(0, MAX_LINES);
  const b = bRaw.split("\n").slice(0, MAX_LINES);

  // trim common prefix / suffix (the 99% case: mostly unchanged files)
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA + 1);
  const midB = b.slice(start, endB + 1);

  const ops: DiffOp[] = a.slice(0, start).map((text) => ({ kind: "same" as const, text }));

  if (midA.length === 0 && midB.length === 0) {
    return ops.concat(a.slice(endA + 1).map((text) => ({ kind: "same" as const, text })));
  }

  // LCS table on the middle section
  const n = midA.length;
  const m = midB.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] =
        midA[i] === midB[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const mid: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      mid.push({ kind: "same", text: midA[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      mid.push({ kind: "del", text: midA[i] });
      i++;
    } else {
      mid.push({ kind: "add", text: midB[j] });
      j++;
    }
  }
  while (i < n) mid.push({ kind: "del", text: midA[i++] });
  while (j < m) mid.push({ kind: "add", text: midB[j++] });

  return ops
    .concat(mid)
    .concat(a.slice(endA + 1).map((text) => ({ kind: "same" as const, text })));
}

export function DiffView({
  before,
  after,
  loading,
  className,
}: {
  before: string;
  after: string;
  loading?: boolean;
  className?: string;
}) {
  const ops = useMemo(() => diffLines(before || "", after || ""), [before, after]);
  const stats = useMemo(() => {
    let add = 0;
    let del = 0;
    for (const op of ops) {
      if (op.kind === "add") add++;
      else if (op.kind === "del") del++;
    }
    return { add, del };
  }, [ops]);
  const identical = stats.add === 0 && stats.del === 0;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* summary strip */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <GitCompareArrows className="size-3.5 text-gold" />
          Version diff
        </span>
        {loading ? (
          <Loader2 className="size-3.5 animate-spin text-gold" aria-label="Computing diff" />
        ) : identical ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            identical
          </span>
        ) : (
          <span className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-gold">+{stats.add}</span>
            <span className="text-rose-400">−{stats.del}</span>
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? null : identical ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            These two versions are identical.
          </div>
        ) : (
          <ol className="min-w-max font-mono text-xs leading-[1.7]">
            {ops.map((op, idx) =>
              op.kind === "same" ? (
                <li key={idx} className="flex">
                  <span className="w-10 shrink-0 select-none pr-3 text-right text-white/20">
                    {idx + 1}
                  </span>
                  <span className="whitespace-pre-wrap break-all text-zinc-500">{op.text || " "}</span>
                </li>
              ) : (
                <li
                  key={idx}
                  className={cn(
                    "flex",
                    op.kind === "add" ? "bg-gold/[0.09]" : "bg-rose-500/[0.09]"
                  )}
                >
                  <span
                    className={cn(
                      "w-10 shrink-0 select-none pr-3 text-right",
                      op.kind === "add" ? "text-gold/70" : "text-rose-400/70"
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "w-4 shrink-0 select-none",
                      op.kind === "add" ? "text-gold" : "text-rose-400"
                    )}
                  >
                    {op.kind === "add" ? "+" : "−"}
                  </span>
                  <span
                    className={cn(
                      "whitespace-pre-wrap break-all",
                      op.kind === "add" ? "text-gold" : "text-rose-300"
                    )}
                  >
                    {op.text || " "}
                  </span>
                </li>
              )
            )}
          </ol>
        )}
      </div>
    </div>
  );
}
