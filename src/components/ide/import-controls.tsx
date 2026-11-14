"use client";

/**
 * Import existing files / folders into Lovify.
 *
 * A hidden pair of <input type="file"> elements — one for a whole folder
 * (webkitdirectory) and one for loose files — read the picked text files
 * client-side and POST them to /api/projects/import, which assembles a
 * runnable single-file app and opens it in the builder IDE.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ApiError, importProject } from "@/lib/api";

const TEXT_EXT = new Set([
  "html", "htm", "css", "js", "mjs", "json", "md", "svg", "txt",
  "csv", "xml", "webmanifest", "ts", "jsx", "tsx",
]);

const SKIP_SEGMENTS = ["node_modules/", ".git/", "dist/", "build/", ".next/", "__macosx/"];

const MAX_FILES = 80;
const MAX_FILE_BYTES = 400_000;

export function useImporters() {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const folderRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);

  const runImport = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0 || importing) return;
      setImporting(true);
      const toastId = toast.loading("Reading files…");
      try {
        const files: { path: string; content: string }[] = [];
        let rootName: string | null = null;

        for (const f of Array.from(list)) {
          const rel = (
            (f as File & { webkitRelativePath?: string }).webkitRelativePath ||
            f.name
          ).replace(/\\/g, "/");
          const lower = rel.toLowerCase();
          if (SKIP_SEGMENTS.some((s) => lower.includes(`/${s}`) || lower.startsWith(s))) continue;
          const ext = lower.split(".").pop() ?? "";
          if (!TEXT_EXT.has(ext)) continue;
          if (f.size > MAX_FILE_BYTES) continue;
          const content = await f.text();
          if (content.includes("\u0000")) continue; // binary, not text
          files.push({ path: rel, content });
          const top = rel.split("/")[0];
          if (rel.includes("/") && (!rootName || top.length < rootName.length)) rootName = top;
          if (files.length >= MAX_FILES) break;
        }

        if (files.length === 0) {
          toast.error("No importable text files found — try html, css, js, json, md or svg.", {
            id: toastId,
          });
          return;
        }

        toast.loading(`Importing ${files.length} files…`, { id: toastId });
        const name =
          (rootName
            ? rootName.replace(/[-_]+/g, " ").replace(/\.html?$/i, "").trim()
            : ""
          )
            .slice(0, 60) || "Imported App";
        const project = await importProject({ name, files });
        toast.success(`Imported ${files.length} files — opening workspace`, { id: toastId });
        router.push(`/builder/${project.id}`);
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Import failed. Please try again.",
          { id: toastId }
        );
      } finally {
        setImporting(false);
      }
    },
    [importing, router]
  );

  const inputs = useMemo(
    () => (
      <>
        <input
          ref={folderRef}
          type="file"
          multiple
          hidden
          aria-hidden="true"
          tabIndex={-1}
          {...({ webkitdirectory: "true", directory: "true" } as Record<string, string>)}
          onChange={(e) => {
            void runImport(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        <input
          ref={filesRef}
          type="file"
          multiple
          hidden
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            void runImport(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </>
    ),
    [runImport]
  );

  return {
    importing,
    openFolder: () => folderRef.current?.click(),
    openFiles: () => filesRef.current?.click(),
    inputs,
  };
}
