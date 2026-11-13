"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders an app HTML document as a non-interactive, auto-scaled thumbnail.
 * The inner document is laid out at 1280x800 and scaled down to fit the
 * container width — like a browser thumbnail. Works everywhere (no container
 * query units needed).
 */
export function ScaledThumb({
  html,
  title,
  className = "",
}: {
  html: string | null | undefined;
  title: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / 1280);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!html) return null;

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden bg-white ${className}`}
      aria-hidden="true"
    >
      <iframe
        srcDoc={html}
        title={title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
        loading="lazy"
        tabIndex={-1}
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
        style={{
          width: 1280,
          height: 800,
          transform: scale ? `scale(${scale})` : undefined,
          visibility: scale ? "visible" : "hidden",
        }}
      />
    </div>
  );
}
