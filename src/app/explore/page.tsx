"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ExternalLink, Eye, Heart, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";
import { ScaledThumb } from "@/components/scaled-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, exploreAppsFiltered, toggleLike } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import type { ExploreApp, ExploreSort } from "@/lib/types";

const SORTS: { id: ExploreSort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "liked", label: "Most loved" },
  { id: "viewed", label: "Most viewed" },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

export default function ExplorePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sort, setSort] = useState<ExploreSort>("newest");
  const [apps, setApps] = useState<ExploreApp[] | null>(null);
  const [failed, setFailed] = useState(false);
  const reqIdRef = useRef(0);

  /* Wake the backend once on arrival. */
  useEffect(() => {
    fetch("/api/boot-services").catch(() => {});
  }, []);

  /* Debounce the search box by 300ms. */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  /* Fetch the gallery whenever the query or sort changes. */
  useEffect(() => {
    const reqId = ++reqIdRef.current;
    exploreAppsFiltered({
      q: debouncedQ || undefined,
      sort,
      withHtml: true,
    })
      .then((d) => {
        if (reqId !== reqIdRef.current) return;
        setApps(d.apps);
        setFailed(false);
      })
      .catch(() => {
        if (reqId !== reqIdRef.current) return;
        setFailed(true);
      });
  }, [debouncedQ, sort]);

  async function handleLike(slug: string) {
    if (!useAuthStore.getState().token) {
      toast("Sign in to like apps");
      router.push("/auth");
      return;
    }
    const current = apps?.find((a) => a.slug === slug);
    if (!current) return;
    const prevLiked = current.liked ?? false;
    const prevLikes = current.likes ?? 0;
    const nextLiked = !prevLiked;

    /* optimistic flip */
    setApps((prev) =>
      prev
        ? prev.map((a) =>
            a.slug === slug
              ? {
                  ...a,
                  liked: nextLiked,
                  likes: Math.max(0, prevLikes + (nextLiked ? 1 : -1)),
                }
              : a
          )
        : prev
    );

    try {
      const res = await toggleLike(slug);
      setApps((prev) =>
        prev
          ? prev.map((a) =>
              a.slug === slug ? { ...a, liked: res.liked, likes: res.likes } : a
            )
          : prev
      );
    } catch (err) {
      /* revert on failure */
      setApps((prev) =>
        prev
          ? prev.map((a) =>
              a.slug === slug ? { ...a, liked: prevLiked, likes: prevLikes } : a
            )
          : prev
      );
      toast.error(err instanceof ApiError ? err.message : "Could not update like");
    }
  }

  function clearSearch() {
    setQ("");
    setDebouncedQ("");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <BrandLogo size={24} />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" aria-current="page">
              <Link href="/explore">Explore</Link>
            </Button>
            <Button asChild>
              <Link href="/">Start building</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden pb-10 pt-16 text-center">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-grid" />
          </div>
          <div className="relative mx-auto max-w-3xl px-6">
            <p className="eyebrow">Fresh from the community</p>
            <h1 className="mt-5 text-5xl tracking-tight sm:text-6xl">
              <span className="font-semibold">Explore </span>
              <span className="font-display italic text-[1.1em]">live apps</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Real apps built with Lovify, published by real builders. Open any of them — or build your own in the next minute.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-6">
          {/* search + sort controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search live apps…"
                aria-label="Search apps"
                className="rounded-full border-white/10 bg-white/[0.03] pl-9"
              />
            </div>
            <div role="group" aria-label="Sort apps" className="flex flex-wrap items-center gap-1.5">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={sort === s.id}
                  onClick={() => setSort(s.id)}
                  className={`rounded-full border px-3.5 py-2 text-xs transition-colors ${
                    sort === s.id
                      ? "border-gold/45 bg-gold/15 text-foreground"
                      : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {failed ? (
            <div className="glass-panel mx-auto mt-10 max-w-md rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Could not load the gallery. Please refresh in a moment.
              </p>
            </div>
          ) : apps === null ? (
            <div className="flex items-center justify-center gap-3 py-24 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-gold" />
              Loading the gallery…
            </div>
          ) : apps.length === 0 ? (
            debouncedQ ? (
              <div className="glass-panel mx-auto mt-10 max-w-md rounded-xl p-10 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Search className="size-6 text-gold" aria-hidden="true" />
                </div>
                <h2 className="mt-5 font-display text-xl tracking-normal">
                  No apps match &ldquo;{debouncedQ}&rdquo;
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try a different keyword, or clear the search to see everything.
                </p>
                <Button variant="ghost" className="mt-6" onClick={clearSearch}>
                  Clear search
                </Button>
              </div>
            ) : (
              <div className="glass-panel mx-auto mt-10 max-w-md rounded-xl p-10 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Sparkles className="size-6 text-gold" aria-hidden="true" />
                </div>
                <h2 className="mt-5 font-display text-xl tracking-normal">Nothing published yet</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Be the first — describe an app, publish it, and it will appear here.
                </p>
                <Button
                  asChild
                  className="mt-6"
                >
                  <Link href="/">Build the first one</Link>
                </Button>
              </div>
            )
          ) : (
            <>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {apps.length} live app{apps.length === 1 ? "" : "s"}
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                {apps.map((app, i) => (
                  <motion.div
                    key={app.slug}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${app.name}`}
                    onClick={() => window.open(`/p/${app.slug}`, "_blank", "noopener")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        window.open(`/p/${app.slug}`, "_blank", "noopener");
                      }
                    }}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: (i % 3) * 0.06 }}
                    className={`luxe-card group cursor-pointer overflow-hidden rounded-xl transition-colors duration-300 hover:border-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      i === 0 ? "sm:col-span-2" : ""
                    }`}
                  >
                    <div
                      className={`relative ${i === 0 ? "aspect-[21/9]" : "aspect-[16/10]"}`}
                    >
                      {app.html ? (
                        <ScaledThumb
                          html={app.html}
                          title={app.name}
                          className="absolute inset-0 h-full w-full"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-white/[0.02]">
                          <Sparkles className="h-8 w-8 text-white/15" aria-hidden="true" />
                        </div>
                      )}
                      <span className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                        Open app <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{app.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {app.description || "Built with Lovify"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="text-[11px] text-muted-foreground">
                          {timeAgo(app.published_at)}
                        </span>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            aria-label={`Like ${app.name}`}
                            aria-pressed={app.liked ?? false}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              void handleLike(app.slug);
                            }}
                            className={`inline-flex items-center gap-1 text-xs transition-transform hover:scale-110 ${
                              app.liked ? "text-gold" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Heart
                              className={`size-3.5 ${app.liked ? "fill-current" : ""}`}
                              aria-hidden="true"
                            />
                            {app.likes}
                          </button>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Eye className="size-3.5" aria-hidden="true" />
                            {app.views}
                          </span>
                          <a
                            href={`/u/${app.author}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              window.open(`/u/${app.author}`, "_blank", "noopener");
                            }}
                            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                          >
                            @{app.author}
                          </a>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="mt-auto border-t border-white/[0.06] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-5 text-center sm:flex-row sm:px-6 sm:text-left">
          <BrandLogo size={20} />
          <span className="text-sm text-muted-foreground">Built with Z.AI — every app on this page, too.</span>
        </div>
      </footer>
    </div>
  );
}
