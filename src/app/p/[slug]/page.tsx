"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppWindow, Eye, GitFork, Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { ApiError, getPublishedApp, remixApp, toggleLike } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import type { PublishedApp } from "@/lib/types";

export default function PublishedAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const [state, setState] = useState<{
    slug: string;
    app: PublishedApp | null;
    failed: boolean;
  }>({ slug, app: null, failed: false });
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [remixing, setRemixing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublishedApp(slug)
      .then((a) => {
        if (cancelled) return;
        setState({ slug, app: a, failed: false });
        setLikes(a.likes ?? 0);
        setLiked(false);
      })
      .catch(() => {
        if (cancelled) return;
        setState({ slug, app: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loading = state.slug !== slug || (!state.app && !state.failed);
  const app = state.slug === slug ? state.app : null;
  const failed = state.slug === slug && state.failed;

  async function handleLike() {
    if (!useAuthStore.getState().token) {
      toast("Sign in to like apps");
      router.push("/auth");
      return;
    }
    const prevLiked = liked;
    const prevLikes = likes;
    const nextLiked = !prevLiked;

    /* optimistic flip */
    setLiked(nextLiked);
    setLikes(Math.max(0, prevLikes + (nextLiked ? 1 : -1)));

    try {
      const res = await toggleLike(slug);
      setLiked(res.liked);
      setLikes(res.likes);
    } catch (err) {
      /* revert on failure */
      setLiked(prevLiked);
      setLikes(prevLikes);
      toast.error(err instanceof ApiError ? err.message : "Could not update like");
    }
  }

  async function handleRemix() {
    if (remixing) return;
    if (!useAuthStore.getState().token) {
      router.push("/auth");
      return;
    }
    setRemixing(true);
    try {
      const res = await remixApp(slug);
      toast.success("Remixed — opening your copy");
      router.push(`/builder/${res.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Remix failed. Please try again.");
      setRemixing(false);
    }
  }

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

  const author = app.author ?? "builder";

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

      {/* Floating action bar */}
      <div className="glass-panel fixed right-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] flex-wrap justify-end gap-2 rounded-full px-2 py-1.5">
        <button
          type="button"
          aria-pressed={liked}
          aria-label={liked ? `Unlike ${app.name}` : `Like ${app.name}`}
          onClick={() => void handleLike()}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
            liked
              ? "border border-gold/30 bg-gold/10 text-gold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className={`size-3.5 ${liked ? "fill-current" : ""}`} aria-hidden="true" />
          {likes}
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-muted-foreground">
          <Eye className="size-3.5" aria-hidden="true" />
          {app.views ?? 0}
        </span>
        <button
          type="button"
          onClick={() => void handleRemix()}
          disabled={remixing}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {remixing ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <GitFork className="size-3.5" aria-hidden="true" />
          )}
          Remix
        </button>
        <span className="inline-flex items-center px-1.5 py-1.5 text-xs text-muted-foreground">
          <a
            href={`/u/${author}`}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            @{author}
          </a>
        </span>
      </div>

      {/* Floating Lovify badge */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="glass-panel fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full py-2 pl-3 pr-4 text-xs text-muted-foreground shadow-lg transition-colors hover:text-foreground"
      >
        <BrandLogo size={18} withText={false} href={null} />
        {app.author_name ? (
          <span>
            Built by <span className="font-medium text-foreground">{app.author_name}</span> · Lovify
          </span>
        ) : (
          <span>
            Built with <span className="font-medium text-foreground">Lovify</span>
          </span>
        )}
      </a>
    </>
  );
}
