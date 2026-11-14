"use client";

/**
 * Root-level error boundary — the last resort when the whole document fails
 * to render (layout-level crash). Must render its own <html>/<body>.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[lovify] fatal error:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          color: "#fafafa",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "26rem",
            textAlign: "center",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "1rem",
            background: "rgba(255,255,255,0.03)",
            padding: "2.5rem 2rem",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              margin: "0 auto",
              width: "3.5rem",
              height: "3.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "0.75rem",
              border: "1px solid rgba(251,191,130,0.25)",
              background: "rgba(230,160,60,0.08)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#e6a83c"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <p
            style={{
              marginTop: "1.5rem",
              fontSize: "0.625rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#e6a83c",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
            }}
          >
            Lovify hit a fatal error
          </p>
          <h1 style={{ marginTop: "0.5rem", fontSize: "1.5rem", fontWeight: 600 }}>
            The app could not load
          </h1>
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#a1a1aa",
            }}
          >
            A critical error stopped Lovify from rendering. Reload to get back
            to building.
          </p>
          <div
            style={{
              marginTop: "1.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1.25rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "#e6a83c",
                color: "#0a0a0a",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                fontSize: "0.875rem",
                color: "#a1a1aa",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
