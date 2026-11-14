/**
 * Virtual workspace files for a Lovify project.
 *
 * The Z.AI brain generates a single self-contained HTML document. The
 * explorer still deserves a real-feeling file tree, so the document is
 * split into the three layers it actually contains:
 *
 *   index.html  — the full source of record (what the preview runs)
 *   styles.css  — the extracted <style> layer
 *   app.js      — the extracted <script> layer
 *
 * plus a generated README.md that records the app's brief.
 */

export type VLang = "html" | "css" | "javascript" | "markdown" | "diff";

export interface VFile {
  path: string;
  lang: VLang;
  content: string;
  /** Short human label for tabs / tree rows. */
  label: string;
}

function fileName(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

/** VS Code-ish monogram per language — kept semantic, not decorative. */
export function langOf(path: string): VLang {
  const n = fileName(path).toLowerCase();
  if (n.endsWith(".html") || n.endsWith(".htm")) return "html";
  if (n.endsWith(".css")) return "css";
  if (n.endsWith(".js") || n.endsWith(".mjs")) return "javascript";
  if (n.endsWith(".md")) return "markdown";
  if (n.endsWith(".diff")) return "diff";
  return "markdown";
}

/** Language id shown in the status bar, VS Code style. */
export function languageLabel(lang: VLang): string {
  switch (lang) {
    case "html":
      return "HTML";
    case "css":
      return "CSS";
    case "javascript":
      return "JavaScript";
    case "diff":
      return "Diff";
    default:
      return "Markdown";
  }
}

export function readmeFor(name: string, prompt: string): string {
  return [
    `# ${name}`,
    "",
    `> Built with Lovify — the AI app builder powered by Z.AI.`,
    "",
    "## Brief",
    "",
    prompt.trim() || "No brief recorded.",
    "",
    "## Layout",
    "",
    "| File      | Role                                    |",
    "| --------- | --------------------------------------- |",
    "| index.html | Full source of record — what preview runs |",
    "| styles.css | Extracted stylesheet layer              |",
    "| app.js     | Extracted behavior layer                |",
    "",
    "Edit anything by asking the chat on the right — Lovify rebuilds the app.",
  ].join("\n");
}

/**
 * Split the generated single-file HTML into the virtual workspace tree.
 * Order matters: index.html first, then styles.css, app.js, README.md.
 */
export function splitProjectFiles(
  html: string | null,
  name: string,
  prompt: string
): VFile[] {
  const files: VFile[] = [];
  if (html && html.trim()) {
    files.push({ path: "index.html", label: "index.html", lang: "html", content: html });

    const styles: string[] = [];
    const scripts: string[] = [];
    html.replace(
      /<style[^>]*>([\s\S]*?)<\/style>/gi,
      (_m, css: string) => {
        const t = css.trim();
        if (t) styles.push(t);
        return _m;
      }
    );
    html.replace(
      /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
      (_m, js: string) => {
        const t = js.trim();
        if (t) scripts.push(t);
        return _m;
      }
    );
    if (styles.length) {
      files.push({
        path: "styles.css",
        label: "styles.css",
        lang: "css",
        content: styles.join("\n\n"),
      });
    }
    if (scripts.length) {
      files.push({
        path: "app.js",
        label: "app.js",
        lang: "javascript",
        content: scripts.join("\n\n"),
      });
    }
  }
  files.push({
    path: "README.md",
    label: "README.md",
    lang: "markdown",
    content: readmeFor(name, prompt),
  });
  return files;
}
