"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Compass, Eye, Heart, Loader2, Rocket, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { format, isValid } from "date-fns";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { ApiError, getBuilderProfile } from "@/lib/api";
import type { BuilderProfile } from "@/lib/types";

type ProfileState =
  | { status: "loading" }
  | { status: "ready"; profile: BuilderProfile }
  | { status: "notFound" }
  | { status: "error" };

function initialOf(name: string): string {
  return (name.trim()?.[0] ?? "?").toUpperCase();
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function BuilderProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const [state, setState] = useState<ProfileState>({ status: "loading" });

  const fetchProfile = useCallback((h: string) => {
    getBuilderProfile(h)
      .then((profile) => setState({ status: "ready", profile }))
      .catch((err: unknown) => {
        setState(
          err instanceof ApiError && err.status === 404
            ? { status: "notFound" }
            : { status: "error" }
        );
      });
  }, []);

  useEffect(() => {
    fetchProfile(handle);
  }, [handle, fetchProfile]);

  const profile = state.status === "ready" ? state.profile : null;
  const joinedDate = profile?.joined ? new Date(profile.joined) : null;
  const joinedLabel =
    joinedDate && isValid(joinedDate) ? format(joinedDate, "MMM yyyy") : null;
  const heroInitial = initialOf(profile?.name || profile?.handle || "?");

  function handleRetry() {
    setState({ status: "loading" }); // event handler — safe to set sync
    fetchProfile(handle);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-background/75 px-4 backdrop-blur-xl sm:px-6">
        <BrandLogo size={24} />
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Link href="/explore">
            <Compass className="size-4" aria-hidden="true" />
            Explore
          </Link>
        </Button>
      </header>

      <main className="flex flex-1 flex-col">
        {state.status === "loading" ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-gold" aria-hidden="true" />
            Loading profile…
          </div>
        ) : !profile ? (
          /* -------- not found / failed -------- */
          <div className="flex flex-1 items-center justify-center px-4 py-16">
            <div className="glass-panel w-full max-w-sm rounded-xl p-8 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-xl border border-rose-400/25 bg-rose-500/10">
                <UserRound className="size-6 text-rose-400" aria-hidden="true" />
              </div>
              <h1 className="mt-5 font-display text-xl tracking-normal">
                {state.status === "notFound" ? "Builder not found" : "Couldn’t load this profile"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {state.status === "notFound" ? (
                  <>
                    No builder goes by{" "}
                    <span className="font-mono text-gold">@{handle}</span> right now.
                  </>
                ) : (
                  "Something went wrong on our side. Please try again."
                )}
              </p>
              {state.status === "error" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRetry}
                  className="mt-4 w-full"
                >
                  Try again
                </Button>
              ) : null}
              <Button asChild className="mt-4 w-full">
                <Link href="/">Build your own on Lovify</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* -------- hero -------- */}
            <section className="flex flex-col items-center py-14 text-center">
              <span
                aria-hidden="true"
                className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] font-display text-2xl"
              >
                {heroInitial}
              </span>
              <h1 className="mt-5 font-display text-4xl tracking-normal">
                {profile.name || profile.handle}
              </h1>
              <p className="mt-1.5 font-mono text-sm text-gold">@{profile.handle}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {joinedLabel ? (
                  <>
                    Building since <span className="text-foreground">{joinedLabel}</span>
                  </>
                ) : (
                  "Building on Lovify"
                )}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-muted-foreground">
                  <Rocket className="size-4 text-gold" aria-hidden="true" />
                  {profile.apps_published} app{profile.apps_published === 1 ? "" : "s"} published
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-muted-foreground">
                  <Eye className="size-4 text-gold" aria-hidden="true" />
                  {profile.total_views.toLocaleString()} views
                </span>
              </div>
            </section>

            {/* -------- apps grid -------- */}
            <section
              aria-label="Published apps"
              className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6"
            >
              {profile.apps.length === 0 ? (
                <div className="glass-panel mx-auto max-w-md rounded-xl p-8 text-center">
                  <p className="font-display text-lg tracking-normal">No published apps yet</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    When @{profile.handle} publishes, it will show up here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {profile.apps.map((app, i) => (
                    <motion.div
                      key={app.slug}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: (i % 3) * 0.06, ease: "easeOut" }}
                    >
                      <Link
                        href={`/p/${app.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${app.name} in a new tab`}
                        className="luxe-card group block overflow-hidden rounded-xl transition-colors hover:border-white/[0.16]"
                      >
                        <div className="flex aspect-[16/10] items-center justify-center bg-white/[0.02]">
                          <span
                            aria-hidden="true"
                            className="font-display text-5xl italic text-white/[0.09]"
                          >
                            {initialOf(app.name)}
                          </span>
                        </div>
                        <div className="p-4">
                          <p className="truncate text-sm font-medium">{app.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {app.description || "Built with Lovify"}
                          </p>
                          <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Heart className="size-3 text-gold" aria-hidden="true" />
                              {app.likes}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Eye className="size-3" aria-hidden="true" />
                              {app.views}
                            </span>
                            <span className="ml-auto">{timeAgo(app.published_at)}</span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-white/[0.06] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:px-6 sm:text-left">
          <BrandLogo size={20} />
          <span className="text-sm text-muted-foreground">
            Every app here was built by prompting, powered by Z.AI
          </span>
        </div>
      </footer>
    </div>
  );
}
