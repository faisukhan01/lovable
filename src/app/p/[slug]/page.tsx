"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AppWindow, Loader2 } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { getPublishedApp } from "@/lib/api";
import type { PublishedApp } from "@/lib/types";

export default function PublishedAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [state, setState] = useState<{
    slug: string;
    app: PublishedApp | null;
    failed: boolean;
  }>({ slug, app: null, failed: false });

  useEffect(() => {
    let cancelled = false;
    getPublishedApp(slug)
      .then((a) => {
        if (!cancelled) setState({ slug, app: a, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ slug, app: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loading = state.slug !== slug || (!state.app && !state.failed);
  const app = state.slug === slug ? state.app : null;
  const failed = state.slug === slug && state.failed;

  if (loading) {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-4">
        <BrandLogo size={40} href={null} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-gold" />
          Loading app…
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="fixed inset-0 z-10 flex items-center justify-center px-4">
        <div className="glass-panel w-full max-w-sm rounded-xl p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-xl border border-rose-400/25 bg-rose-500/10">
            <AppWindow className="size-6 text-rose-400" />
          </div>
          <h1 className="mt-5 font-display text-xl tracking-normal">
            This app isn&rsquo;t published (or no longer exists).
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The link may be wrong, or the builder took it offline.
          </p>
          <Button
            asChild
            className="mt-6 w-full"
          >
            <Link href="/">Build your own on Lovify</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* The published app itself */}
      <div className="fixed inset-0 z-0">
        <iframe
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          srcDoc={app.html}
          title={app.name}
          className="h-full w-full bg-white"
        />
      </div>

      {/* Floating Lovify badge */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="glass-panel fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full py-2 pl-3 pr-4 text-xs text-muted-foreground shadow-lg transition-colors hover:text-foreground"
      >
        <BrandLogo size={18} withText={false} href={null} />
        <span>
          Built with <span className="font-medium text-foreground">Lovify</span>
        </span>
      </a>
    </>
  );
}
