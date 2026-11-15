/**
 * VS Code "Dark+" prism palette — the exact token colors of the real
 * editor, for react-syntax-highlighter:
 *   keyword  #569CD6 / control #C586C0     string   #CE9178
 *   comment  #6A9955                        number   #B5CEA8
 *   function #DCDCAA                        class    #4EC9B0
 *   tag      #569CD6                        attr     #9CDCFE
 *   plain    #D4D4D4
 */
import type { CSSProperties } from "react";

const t = (color: string, extra?: CSSProperties): CSSProperties => ({
  color,
  ...extra,
});

export const darkPlus: Record<string, CSSProperties> = {
  'code[class*="language-"]': {
    color: "#D4D4D4",
    background: "transparent",
    textShadow: "none",
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
    whiteSpace: "pre",
  },
  'pre[class*="language-"]': {
    background: "transparent",
  },
  comment: t("#6A9955"),
  prolog: t("#6A9955"),
  doctype: t("#6A9955"),
  cdata: t("#6A9955"),
  punctuation: t("#D4D4D4"),
  property: t("#9CDCFE"),
  tag: t("#569CD6"),
  boolean: t("#569CD6"),
  number: t("#B5CEA8"),
  constant: t("#4FC1FF"),
  symbol: t("#4FC1FF"),
  deleted: t("#F14C4C"),
  selector: t("#D7BA7D"),
  "attr-name": t("#9CDCFE"),
  string: t("#CE9178"),
  char: t("#CE9178"),
  builtin: t("#4EC9B0"),
  inserted: t("#B5CEA8"),
  operator: t("#D4D4D4"),
  entity: t("#569CD6"),
  url: t("#9CDCFE"),
  "string property": t("#CE9178"),
  atrule: t("#C586C0"),
  "attr-value": t("#CE9178"),
  keyword: t("#569CD6"),
  "keyword-control": t("#C586C0"),
  "keyword-operator": t("#D4D4D4"),
  function: t("#DCDCAA"),
  "function-variable": t("#DCDCAA"),
  "title.function": t("#DCDCAA"),
  class: t("#4EC9B0"),
  "class-name": t("#4EC9B0"),
  "title.class": t("#4EC9B0"),
  "maybe-class-name": t("#4EC9B0"),
  regex: t("#D16969"),
  important: t("#569CD6"),
  annotation: t("#DCDCAA"),
  key: t("#9CDCFE"),
  index: t("#B5CEA8"),
  namespace: t("#9CDCFE"),
  hexcode: t("#B5CEA8"),
  heading: t("#569CD6", { fontWeight: 700 }),
  bold: t("#D4D4D4", { fontWeight: 700 }),
  italic: t("#D4D4D4", { fontStyle: "italic" }),
  list: t("#B5CEA8"),
  "list-punctuation": t("#6A9955"),
  urlReference: t("#9CDCFE"),
  "title": t("#DCDCAA"),
  "parameter": t("#9CDCFE"),
  "script": t("#569CD6"),
  "style": t("#569CD6"),
};
