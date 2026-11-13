"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  Folder,
  Heart,
  History,
  Loader2,
  LogOut,
  MessagesSquare,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getMyLikes, getMyUsage, updateMe } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import type { ExploreApp, UsageStats } from "@/lib/types";

const USAGE_TILES: { key: keyof UsageStats; label: string; icon: LucideIcon }[] = [
  { key: "projects", label: "Projects", icon: Folder },
  { key: "published", label: "Published", icon: Rocket },
  { key: "versions", label: "Versions", icon: History },
  { key: "messages", label: "Messages", icon: MessagesSquare },
  { key: "likes_received", label: "Likes received", icon: Heart },
  { key: "views_received", label: "Views", icon: Eye },
];

export default function SettingsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const clear = useAuthStore((s) => s.clear);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);

  const [liked, setLiked] = useState<ExploreApp[] | null>(null);
  const [likedError, setLikedError] = useState<string | null>(null);

  /* Auth guard */
  useEffect(() => {
    if (hasHydrated && !token) router.replace("/auth");
  }, [hasHydrated, token, router]);

  /* Keep the display-name field in sync with the stored user */
  useEffect(() => {
    setName(user?.name ?? "");
  }, [user]);

  const loadUsage = useCallback(async () => {
    setUsageError(null);
    try {
      const u = await getMyUsage();
      setUsage(u);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Could not load your usage. Please try again.";
      setUsageError(msg);
      toast.error(msg);
    }
  }, []);

  const loadLikes = useCallback(async () => {
    setLikedError(null);
    try {
      const res = await getMyLikes();
      setLiked(res.apps);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Could not load your liked apps. Please try again.";
      setLikedError(msg);
      toast.error(msg);
    }
  }, []);

  /* Both sections fetch independently, in parallel */
  useEffect(() => {
    if (hasHydrated && token) void loadUsage();
  }, [hasHydrated, token, loadUsage]);

  useEffect(() => {
    if (hasHydrated && token) void loadLikes();
  }, [hasHydrated, token, loadLikes]);

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const res = await updateMe(trimmed);
      useAuthStore.setState({ user: res.user });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not update your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    clear();
    router.replace("/");
  }

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
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-background/75 px-4 backdrop-blur-xl sm:px-6">
        <BrandLogo href="/dashboard" size={24} />
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Link href="/dashboard">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="space-y-6">
          {/* Title */}
          <div>
            <p className="eyebrow">Account</p>
            <h1 className="mt-1.5 font-display text-3xl tracking-normal">Settings</h1>
          </div>

          {/* -------- Section A — Profile -------- */}
          <section aria-label="Profile" className="luxe-card space-y-5 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] font-semibold"
              >
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {user?.name?.trim() || "Lovify builder"}
                </p>
                <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="display-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder="Your name"
                  autoComplete="name"
                  className="sm:max-w-sm"
                />
                <Button
                  type="submit"
                  disabled={saving || name.trim().length === 0}
                  className="shrink-0"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Shown on your public builder profile and published apps.
              </p>
            </form>
          </section>

          {/* -------- Section B — Usage -------- */}
          <section aria-label="Usage" className="luxe-card space-y-4 rounded-2xl p-6">
            <h2 className="font-display text-lg tracking-normal">Your studio in numbers</h2>

            {usageError && !usage ? (
              <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 sm:flex-row sm:items-center">
                <p className="text-sm text-rose-200">{usageError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadUsage()}
                  className="shrink-0"
                >
                  Try again
                </Button>
              </div>
            ) : !usage ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <Skeleton className="h-8 w-14 bg-white/5" />
                    <Skeleton className="mt-3 h-3 w-20 bg-white/5" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {USAGE_TILES.map((tile) => {
                  const Icon = tile.icon;
                  return (
                    <div
                      key={tile.key}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-display text-3xl leading-none">
                          {usage[tile.key].toLocaleString()}
                        </span>
                        <Icon className="size-4 shrink-0 text-gold" aria-hidden="true" />
                      </div>
                      <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {tile.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* -------- Section C — Liked apps -------- */}
          <section aria-label="Liked apps" className="luxe-card space-y-4 rounded-2xl p-6">
            <h2 className="font-display text-lg tracking-normal">Apps you loved</h2>

            {likedError && !liked ? (
              <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 sm:flex-row sm:items-center">
                <p className="text-sm text-rose-200">{likedError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadLikes()}
                  className="shrink-0"
                >
                  Try again
                </Button>
              </div>
            ) : !liked ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <Skeleton className="h-4 w-1/3 bg-white/5" />
                    <Skeleton className="mt-2 h-3 w-2/3 bg-white/5" />
                  </div>
                ))}
              </div>
            ) : liked.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing liked yet &mdash; tap a heart in{" "}
                <Link
                  href="/explore"
                  className="text-gold underline-offset-4 hover:underline"
                >
                  Explore
                </Link>
                .
              </p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {liked.map((app) => (
                  <Link
                    key={app.slug}
                    href={`/p/${app.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${app.name} in a new tab`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/[0.14]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{app.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {app.description || "Built with Lovify"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Heart className="size-3.5 text-gold" aria-hidden="true" />
                      {app.likes}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* -------- Section D — Session -------- */}
          <section aria-label="Session" className="luxe-card space-y-4 rounded-2xl p-6">
            <div>
              <h2 className="font-display text-lg tracking-normal">Session</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign out of Lovify on this device.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              className="border-rose-400/30 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </section>
        </div>
      </main>

      <footer className="mt-auto border-t border-white/[0.06] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:px-6 sm:text-left">
          <BrandLogo size={20} />
          <span className="text-sm text-muted-foreground">Powered by Z.AI</span>
        </div>
      </footer>
    </div>
  );
}
