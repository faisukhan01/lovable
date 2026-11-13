"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Compass,
  Loader2,
  LogOut,
  Plus,
  Rocket,
  Sparkles,
} from "lucide-react";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { ProjectCard } from "@/components/dashboard/project-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, listProjects } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import type { ProjectSummary } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const clear = useAuthStore((s) => s.clear);

  const [projects, setProjects] = useState<(ProjectSummary & { html?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  /* Auth guard */
  useEffect(() => {
    if (hasHydrated && !token) router.replace("/auth");
  }, [hasHydrated, token, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProjects(true);
      setProjects(res.projects);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load your projects. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasHydrated && token) void load();
  }, [hasHydrated, token, load]);

  function handleSignOut() {
    clear();
    router.replace("/");
  }

  function handleDeleted(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  function handleRenamed(id: string, name: string) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }

  const liveCount = projects.filter((p) => p.published_slug).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayName = (user?.name || user?.email?.split("@")[0] || "builder");

  /* Centered loader while hydrating or redirecting to /auth */
  if (!hasHydrated || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gold" aria-label="Loading" />
      </div>
    );
  }

  const initial = (user?.email?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.06] bg-background/80 px-4 backdrop-blur sm:px-6">
        <BrandLogo href="/dashboard" size={24} />
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Explore gallery"
            className="text-muted-foreground sm:hidden"
          >
            <Link href="/explore">
              <Compass className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="hidden text-muted-foreground sm:inline-flex"
          >
            <Link href="/explore">
              <Compass className="size-4" />
              Explore
            </Link>
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New project
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="border border-white/10">
                  <AvatarFallback className="bg-white/[0.08] text-sm font-semibold text-foreground">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <span className="sr-only">Signed in as</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {user?.email ?? "Signed in"}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {greeting}, <span className="text-foreground">{displayName}</span>
            </p>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="font-display text-3xl tracking-normal">
                Your apps
              </h1>
              {!loading && !error ? (
                <Badge
                  variant="secondary"
                  className="border border-white/10 bg-white/[0.06] text-muted-foreground"
                >
                  {projects.length}
                </Badge>
              ) : null}
            </div>
          </div>
          {!loading && !error && projects.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-gold" />
                {projects.length} app{projects.length === 1 ? "" : "s"} built
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-3 py-1.5 text-xs text-gold">
                <Rocket className="size-3.5" />
                {liveCount} live
              </span>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-panel overflow-hidden rounded-2xl">
                <Skeleton className="aspect-video w-full rounded-none bg-white/5" />
                <div className="space-y-3 p-4">
                  <Skeleton className="h-4 w-2/3 bg-white/5" />
                  <Skeleton className="h-3 w-full bg-white/5" />
                  <Skeleton className="h-3 w-1/2 bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-400" />
              <div>
                <p className="font-display font-semibold text-rose-100">
                  Couldn&rsquo;t load your apps
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => void load()} className="shrink-0">
              Try again
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <Sparkles className="size-7 text-gold" />
            </div>
            <h2 className="mt-6 font-display text-2xl tracking-normal">
              Nothing here yet
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Describe an app in one sentence and watch it come to life.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="mt-6"
            >
              <Sparkles className="size-4" />
              Create your first app
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onDeleted={handleDeleted} onRenamed={handleRenamed} />
            ))}
          </div>
        )}
      </main>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
