"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import {
  BrainCircuit,
  ChartNoAxesColumn,
  ExternalLink,
  Gamepad2,
  Github,
  History,
  LayoutGrid,
  ListTodo,
  Loader2,
  Lock,
  MessagesSquare,
  MonitorSmartphone,
  NotebookPen,
  PenLine,
  Rocket,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createProject, exploreApps, getStats } from "@/lib/api";
import { stashPendingPrompt, useAuthStore } from "@/lib/store";
import { EXAMPLE_PROMPTS } from "@/lib/examples";
import type { Stats } from "@/lib/types";
import { BrandLogo } from "@/components/brand-logo";
import { ScaledThumb } from "@/components/scaled-thumb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------ data ------------------------------ */

const EXAMPLE_ICONS: Record<string, LucideIcon> = {
  todo: ListTodo,
  portfolio: UserRound,
  crm: ChartNoAxesColumn,
  game: Gamepad2,
  store: ShoppingBag,
  blog: NotebookPen,
};

const FEATURES: { icon: LucideIcon; title: string; text: string; gradient: string }[] = [
  {
    icon: Wand2,
    title: "Prompt to product",
    text: "One paragraph becomes a complete, working app with real UI, logic and data persistence — not a mockup.",
    gradient: "from-fuchsia-500 to-violet-500",
  },
  {
    icon: MessagesSquare,
    title: "Refine by conversation",
    text: "“Make the header glassy and add search.” Talk to it like a teammate and watch changes land in seconds.",
    gradient: "from-violet-500 to-orange-400",
  },
  {
    icon: MonitorSmartphone,
    title: "Live preview",
    text: "A sandboxed, instant preview of your app on desktop and mobile frames while the AI works.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: History,
    title: "Version history",
    text: "Every change is a version. Browse the timeline and roll back to any point with one click.",
    gradient: "from-orange-500 to-rose-500",
  },
  {
    icon: Rocket,
    title: "One-click publish",
    text: "Ship your app to a public URL instantly. No servers, no config — your app is live when you are.",
    gradient: "from-purple-500 to-fuchsia-500",
  },
  {
    icon: BrainCircuit,
    title: "Z.AI brain",
    text: "Every feature runs on Z.AI models — generation, editing, and platform intelligence.",
    gradient: "from-amber-500 to-orange-500",
  },
];

const STEPS: { icon: LucideIcon; title: string; text: string; gradient: string }[] = [
  {
    icon: PenLine,
    title: "Describe it",
    text: "Type what you want — features, vibe, pages. The more specific, the better.",
    gradient: "from-violet-500 to-fuchsia-500",
  },
  {
    icon: Sparkles,
    title: "Watch it build",
    text: "Z.AI architects the UI, writes the code and assembles a working app in real time.",
    gradient: "from-fuchsia-500 to-orange-400",
  },
  {
    icon: Rocket,
    title: "Refine & publish",
    text: "Chat your tweaks, pick a version, hit publish — share the link with the world.",
    gradient: "from-orange-500 to-rose-500",
  },
];

const TILE_GRADIENTS = [
  "from-violet-500/20 to-fuchsia-500/10",
  "from-fuchsia-500/15 to-orange-400/10",
  "from-purple-500/20 to-fuchsia-500/10",
  "from-orange-400/15 to-rose-500/10",
  "from-fuchsia-500/20 to-violet-500/15",
  "from-violet-500/15 to-orange-400/10",
];

const TILE_NAME_BARS = ["w-3/4", "w-2/3", "w-4/5", "w-1/2", "w-3/5", "w-2/3"];

/* --------------------------- animation ---------------------------- */

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

/* ---------------------------- helpers ----------------------------- */

const subscribeNoop = () => () => {};

function useCountUp(target: number | null, failed: boolean): string {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (failed || target === null) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, failed]);

  if (failed) return "—";
  return value.toLocaleString("en-US");
}

function scrollToSection(id: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

/* ------------------------- small components ----------------------- */

function StatCounter({ target, failed, label }: { target: number | null; failed: boolean; label: string }) {
  const display = useCountUp(target, failed);
  return (
    <div className="text-center">
      <div className="font-display text-3xl font-bold text-gradient sm:text-4xl">{display}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text, gradient, index }: {
  icon: LucideIcon;
  title: string;
  text: string;
  gradient: string;
  index: number;
}) {
  return (
    <motion.div
      variants={staggerItem}
      transition={{ delay: index * 0.02 }}
      className="glass-panel group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/30! hover:shadow-xl hover:shadow-violet-950/30"
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg shadow-black/30 ring-1 ring-white/15 transition-transform duration-300 group-hover:scale-105`}
      >
        <Icon className="h-5 w-5 text-white" aria-hidden="true" />
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </motion.div>
  );
}

function StepCard({ icon: Icon, title, text, gradient, number }: {
  icon: LucideIcon;
  title: string;
  text: string;
  gradient: string;
  number: string;
}) {
  return (
    <motion.div variants={staggerItem}>
      <div className="relative mb-6 h-16">
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 select-none font-display text-6xl font-bold leading-none text-white/10"
        >
          {number}
        </span>
        <div
          className={`absolute bottom-0 left-9 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg shadow-violet-950/40 ring-1 ring-white/15`}
        >
          <Icon className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
      </div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </motion.div>
  );
}

function BrowserMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl shadow-violet-950/40 animate-float" style={{ animationDuration: "7s" }}>
      {/* window chrome */}
      <div className="relative flex items-center justify-center border-b border-white/5 bg-white/[0.02] px-4 py-3">
        <div className="absolute left-4 flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-500" />
          <span className="h-3 w-3 rounded-full bg-amber-500" />
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
        </div>
        <div className="glass-panel inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3 text-emerald-400" aria-hidden="true" />
          lovify.app/p/aurora-store
        </div>
      </div>
      {/* storefront body */}
      <div className="flex aspect-[16/10]">
        <aside className="hidden w-1/5 flex-col gap-1.5 border-r border-white/5 bg-white/[0.02] p-3 sm:flex">
          <div className="mb-3 h-3 w-16 rounded-full bg-gradient-to-r from-fuchsia-500/50 to-violet-500/50" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                i === 0 ? "border border-violet-400/20 bg-white/5" : ""
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${i === 0 ? "bg-violet-400/70" : "bg-white/10"}`} />
              <span className={`h-2 flex-1 rounded-full ${i === 0 ? "bg-violet-400/40" : "bg-white/5"}`} />
            </div>
          ))}
        </aside>
        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex w-40 items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-muted-foreground sm:w-56">
              <Search className="h-3 w-3" aria-hidden="true" />
              Search products…
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="h-2 w-10 rounded-full bg-white/10" />
              <span className="h-7 w-7 rounded-full bg-gradient-to-br from-orange-400 via-rose-400 to-fuchsia-500 ring-1 ring-white/15" />
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
            {TILE_GRADIENTS.map((g, i) => (
              <div
                key={i}
                className={`flex flex-col gap-2 rounded-xl border border-white/5 bg-gradient-to-br ${g} p-2.5`}
              >
                <div className="flex-1 rounded-lg bg-gradient-to-br from-white/[0.07] to-transparent" />
                <div className={`h-2 rounded-full bg-white/20 ${TILE_NAME_BARS[i]}`} />
                <div className="h-2 w-1/3 rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface LiveApp {
  slug: string;
  name: string;
  description: string;
  html?: string | null;
  published_at?: string | null;
}

function LiveAppFrame({ app, index }: { app: LiveApp; index: number }) {
  const gradients = [
    "from-fuchsia-500/20 to-violet-500/10",
    "from-violet-500/20 to-orange-400/10",
    "from-orange-400/20 to-rose-500/10",
  ];
  return (
    <motion.div
      variants={staggerItem}
      className={`overflow-hidden rounded-2xl border border-white/10 bg-card shadow-xl shadow-violet-950/30 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/40 hover:shadow-2xl hover:shadow-violet-950/50 ${
        index === 0 ? "lg:col-span-2 lg:row-span-1" : ""
      }`}
    >
      {/* window chrome */}
      <div className="relative flex items-center justify-center border-b border-white/5 bg-white/[0.02] px-3 py-2.5">
        <div className="absolute left-3 flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <div className="glass-panel inline-flex max-w-[70%] items-center gap-1.5 rounded-full px-3 py-1 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden="true" />
          <span className="truncate">lovify.app/p/{app.slug}</span>
        </div>
      </div>
      {/* live preview */}
      <div className={`relative aspect-[16/10] bg-gradient-to-br ${gradients[index % 3]}`}>
        {app.html ? (
          <ScaledThumb
            html={app.html}
            title={app.name}
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Sparkles className="h-8 w-8 text-white/20" aria-hidden="true" />
          </div>
        )}
        {/* overlay link */}
        <a
          href={`/p/${app.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${app.name}`}
          className="absolute inset-0 z-10 flex items-end justify-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-300 hover:opacity-100 focus-visible:opacity-100"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-md">
            Open app <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </a>
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">{app.name}</p>
          <p className="truncate text-xs text-muted-foreground">{app.description || "Built with Lovify"}</p>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
          Live
        </span>
      </div>
    </motion.div>
  );
}

/* ------------------------------ page ------------------------------ */

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);
  const [liveApps, setLiveApps] = useState<LiveApp[] | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* False during SSR/hydration render, true afterwards — avoids auth-state
     hydration mismatch without calling setState inside an effect. */
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const token = useAuthStore((s) => s.token);
  const authed = mounted && !!token;

  useEffect(() => {
    let alive = true;
    // Boot the backend services (self-healing keeper) then load social proof.
    fetch("/api/boot-services").catch(() => {});
    getStats()
      .then((s) => {
        if (alive) setStats(s);
      })
      .catch(() => {
        if (alive) setStatsFailed(true);
      });
    exploreApps(true)
      .then((d) => {
        if (alive) setLiveApps(d.apps.slice(0, 3));
      })
      .catch(() => {
        if (alive) setLiveApps([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const submitPrompt = useCallback(async () => {
    const value = prompt.trim();
    if (!value || creating) return;
    const currentToken = useAuthStore.getState().token;
    if (!currentToken) {
      stashPendingPrompt(value);
      router.push("/auth");
      return;
    }
    setCreating(true);
    try {
      const project = await createProject(value);
      router.push(`/builder/${project.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setCreating(false);
    }
  }, [prompt, creating, router]);

  const fillPrompt = (value: string) => {
    setPrompt(value);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* ------------------------------ navbar ------------------------------ */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <BrandLogo />
          <div className="flex items-center gap-6">
            <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
              <a href="#features" onClick={scrollToSection("features")} className="transition hover:text-foreground">
                Features
              </a>
              <a href="#how-it-works" onClick={scrollToSection("how-it-works")} className="transition hover:text-foreground">
                How it works
              </a>
              <Link href="/explore" className="transition hover:text-foreground">
                Explore
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              {authed ? (
                <Button asChild variant="ghost">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="ghost" className="hidden sm:inline-flex">
                    <Link href="/auth">Sign in</Link>
                  </Button>
                  <Button
                    asChild
                    className="bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow-lg shadow-fuchsia-950/30 hover:brightness-110"
                  >
                    <Link href="/auth">Start building</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* ------------------------------ hero ------------------------------ */}
        <section className="relative overflow-hidden pb-20 pt-32">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="aurora-blob animate-aurora -left-24 -top-24 h-[520px] w-[520px] bg-fuchsia-600/40" />
            <div className="aurora-blob animate-aurora-slow -right-40 top-10 h-[620px] w-[620px] bg-violet-600/40" />
            <div className="aurora-blob animate-aurora -bottom-32 left-1/3 h-[480px] w-[480px] bg-orange-500/25" />
            <div className="absolute inset-0 bg-grid" />
          </div>

          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex justify-center"
            >
              <span className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-fuchsia-400" aria-hidden="true" />
                Powered by Z.AI — the brain behind every build
                <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.08 }}
              className="mt-8 font-display text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl"
            >
              Build apps at the
              <br />
              <span className="text-gradient">speed of thought.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.16 }}
              className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
            >
              Describe what you want in plain words. Lovify’s Z.AI brain designs it, codes it and ships a real,
              working app in seconds — then you refine it by simply talking to it.
            </motion.p>

            {/* prompt box */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.24 }}
              className="relative mx-auto mt-10 max-w-3xl"
            >
              <div
                aria-hidden="true"
                className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-fuchsia-500/15 via-violet-500/15 to-orange-400/15 blur-2xl"
              />
              <div
                className={`relative rounded-2xl bg-gradient-to-r p-[1.5px] transition-all duration-300 ${
                  focused
                    ? "from-fuchsia-500 via-violet-500 to-orange-400 shadow-xl shadow-violet-950/40"
                    : "from-fuchsia-500/60 via-violet-500/60 to-orange-400/60"
                }`}
              >
                <div className="rounded-[calc(1rem-1px)] bg-background/80 p-4 backdrop-blur-xl">
                  <Textarea
                    ref={textareaRef}
                    rows={3}
                    value={prompt}
                    disabled={creating}
                    onChange={(e) => setPrompt(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitPrompt();
                      }
                    }}
                    placeholder="A CRM for my coffee shop with inventory, a kanban and sales charts…"
                    aria-label="Describe the app you want to build"
                    className="min-h-[84px] resize-none border-0 bg-transparent p-0 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-muted-foreground">
                        <Zap className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                        Z.AI · Fast model
                      </span>
                      <kbd className="hidden rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-sans text-xs text-muted-foreground sm:inline-block">
                        Enter to build
                      </kbd>
                    </div>
                    <Button
                      onClick={submitPrompt}
                      disabled={creating}
                      className="gap-2 bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow-lg shadow-fuchsia-950/40 hover:brightness-110"
                    >
                      {creating ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                      )}
                      {creating ? "Building…" : "Build it"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* example chips */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.32 }}
              className="mt-5 flex flex-wrap justify-center gap-2"
            >
              {EXAMPLE_PROMPTS.map((ex) => {
                const Icon = EXAMPLE_ICONS[ex.icon] ?? Sparkles;
                return (
                  <button
                    key={ex.icon}
                    type="button"
                    onClick={() => fillPrompt(ex.prompt)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-muted-foreground transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {ex.title}
                  </button>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ---------------------------- stats band ---------------------------- */}
        <section aria-label="Platform statistics" className="mt-4 border-y border-white/5 py-10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-10 px-6 sm:gap-16">
            <StatCounter target={stats ? stats.apps : null} failed={statsFailed} label="apps generated" />
            <StatCounter target={stats ? stats.published : null} failed={statsFailed} label="apps published live" />
            <StatCounter target={stats ? stats.builders : null} failed={statsFailed} label="builders creating" />
          </div>
        </section>

        {/* ----------------------------- features ----------------------------- */}
        <section id="features" className="scroll-mt-20 py-28">
          <div className="mx-auto max-w-6xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="text-center"
            >
              <p className="text-sm font-medium uppercase tracking-widest text-fuchsia-400">Everything included</p>
              <h2 className="mt-3 font-display text-4xl font-bold">A complete builder, not a toy</h2>
            </motion.div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="mt-14 grid gap-5 md:grid-cols-3"
            >
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.title} icon={f.icon} title={f.title} text={f.text} gradient={f.gradient} index={i} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* --------------------------- how it works --------------------------- */}
        <section id="how-it-works" className="scroll-mt-20 py-28">
          <div className="mx-auto max-w-5xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="text-center"
            >
              <p className="text-sm font-medium uppercase tracking-widest text-fuchsia-400">How it works</p>
              <h2 className="mt-3 font-display text-4xl font-bold">From idea to live app in three moves</h2>
            </motion.div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="mt-14 grid gap-6 md:grid-cols-3"
            >
              {STEPS.map((s, i) => (
                <StepCard
                  key={s.title}
                  icon={s.icon}
                  title={s.title}
                  text={s.text}
                  gradient={s.gradient}
                  number={`0${i + 1}`}
                />
              ))}
            </motion.div>
          </div>
        </section>

        {/* ----------------------------- showcase ----------------------------- */}
        <section id="showcase" className="scroll-mt-20 py-28">
          <div className="mx-auto max-w-6xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="text-center"
            >
              <p className="text-sm font-medium uppercase tracking-widest text-fuchsia-400">See it in action</p>
              <h2 className="mt-3 font-display text-4xl font-bold">Real apps. Zero boilerplate.</h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                {liveApps && liveApps.length > 0
                  ? "These are live right now — every one was built from a single prompt."
                  : "Every app below was built from a single prompt. Yours could be next."}
              </p>
            </motion.div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="mt-14"
            >
              {liveApps === null ? (
                <div className="flex justify-center">
                  <BrowserMock />
                </div>
              ) : liveApps.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {liveApps.map((app, i) => (
                    <LiveAppFrame key={app.slug} app={app} index={i} />
                  ))}
                </div>
              ) : (
                <div className="flex justify-center">
                  <BrowserMock />
                </div>
              )}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <span className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  avg build 38s
                </span>
                <span className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground">
                  <LayoutGrid className="h-4 w-4 text-fuchsia-400" aria-hidden="true" />
                  pixel-perfect responsive
                </span>
                <span className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  sandboxed previews
                </span>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link href="/explore">
                    Explore the gallery
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* -------------------------------- CTA -------------------------------- */}
        <section className="relative overflow-hidden py-28 text-center">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="aurora-blob animate-aurora-slow left-1/2 top-1/2 h-[450px] w-[450px] -translate-x-1/2 -translate-y-1/2 bg-violet-600/20" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative mx-auto max-w-3xl px-6"
          >
            <h2 className="font-display text-4xl font-bold">
              Your next app is <span className="text-gradient">one sentence away.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Type an idea. Get a working app. Refine it like a doc.
            </p>
            <div className="mt-8 flex justify-center">
              <Button
                asChild
                className="shine relative h-12 overflow-hidden px-8 text-base bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow-xl shadow-fuchsia-950/40 hover:brightness-110"
              >
                <Link href="/auth">
                  <Sparkles className="mr-2 h-5 w-5" aria-hidden="true" />
                  Start building free
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">No credit card. No setup. Just describe.</p>
          </motion.div>
        </section>
      </main>

      {/* ------------------------------ footer ------------------------------ */}
      <footer className="mt-auto border-t border-white/5 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <BrandLogo size={24} />
            <span className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Lovify — built with Z.AI
            </span>
          </div>
          <nav aria-label="Footer" className="flex items-center gap-5 text-sm text-muted-foreground">
            <a href="#features" onClick={scrollToSection("features")} className="transition hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" onClick={scrollToSection("how-it-works")} className="transition hover:text-foreground">
              How it works
            </a>
            <Link href="/explore" className="transition hover:text-foreground">
              Explore
            </Link>
            <a
              href="https://github.com/faisukhan01/lovable"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition hover:text-foreground"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
