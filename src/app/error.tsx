"use client";

/**
 * Route-level error boundary. Any unexpected client/server exception in a
 * route segment lands here instead of Next's raw crash screen, styled in the
 * Lovify MONOLITH language with a real recovery path.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real cause in the console for debugging.
    console.error("[lovify] unhandled route error:", error);
  }, [error]);

  return (
    <div className="noise flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-panel w-full max-w-md rounded-2xl p-8 text-center sm:p-10">
        <div
          aria-hidden="true"
          className="mx-auto flex size-14 items-center justify-center rounded-xl border border-rose-400/25 bg-rose-500/10"
        >
          <AlertTriangle className="size-6 text-rose-400" />
        </div>
        <p className="eyebrow mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Something broke
        </p>
        <h1 className="mt-2 font-display text-2xl tracking-normal text-foreground">
          This page hit an error
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          An unexpected error stopped this page from rendering. Trying again
          usually fixes it — your saved apps are safe.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
            ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset} className="gap-2">
            <RotateCcw className="size-4" aria-hidden="true" />
            Try again
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/">
              <Home className="size-4" aria-hidden="true" />
              Back to home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
