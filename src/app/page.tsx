"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  ArrowRight,
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
  Menu,
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
  X,
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

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Wand2,
    title: "Prompt to product",
    text: "One paragraph becomes a complete, working app with real UI, logic and data persistence — not a mockup.",
  },
  {
    icon: MessagesSquare,
    title: "Refine by conversation",
    text: "“Make the header glassy and add search.” Talk to it like a teammate and watch changes land in seconds.",
  },
  {
    icon: MonitorSmartphone,
    title: "Live preview",
    text: "A sandboxed, instant preview of your app on desktop and mobile frames while the AI works.",
  },
  {
    icon: History,
    title: "Version history",
    text: "Every change is a version. Browse the timeline and roll back to any point with one click.",
  },
  {
    icon: Rocket,
    title: "One-click publish",
    text: "Ship your app to a public URL instantly. No servers, no config — your app is live when you are.",
  },
  {
    icon: BrainCircuit,
    title: "Z.AI brain",
    text: "Every feature runs on Z.AI models — generation, editing, and platform intelligence.",
  },
];

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: PenLine,
    title: "Describe it",
    text: "Type what you want — features, vibe, pages. The more specific, the better.",
  },
  {
    icon: Sparkles,
    title: "Watch it build",
    text: "Z.AI architects the UI, writes the code and assembles a working app in real time.",
  },
  {
    icon: Rocket,
    title: "Refine & publish",
    text: "Chat your tweaks, pick a version, hit publish — share the link with the world.",
  },
];

const TILE_NAME_BARS = ["w-3/4", "w-2/3", "w-4/5", "w-1/2", "w-3/5", "w-2/3"];

/* --------------------------- animation ---------------------------- */

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/* ---------------------------- helpers ----------------------------- */

const subscribeNoop = () => () => {};

function useCountUp(target: number | null, failed: boolean): string {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (failed || target === null) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1400;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
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
      <div className="font-display text-5xl leading-none tracking-tight sm:text-6xl">{display}</div>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text, index }: {
  icon: LucideIcon;
  title: string;
  text: string;
  index: number;
}) {
  return (
    <motion.div
      variants={staggerItem}
      transition={{ delay: index * 0.02 }}
      className="luxe-card group rounded-xl p-6 transition-colors duration-300"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] transition-colors duration-300 group-hover:border-gold/30">
        <Icon className="h-[18px] w-[18px] text-gold" aria-hidden="true" />
      </div>
      <h3 className="mt-5 font-display text-lg tracking-normal">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </motion.div>
  );
}

function StepCard({ icon: Icon, title, text, number, last }: {
  icon: LucideIcon;
  title: string;
  text: string;
  number: string;
  last: boolean;
}) {
  return (
    <motion.div variants={staggerItem} className="relative">
      {/* connector rule */}
      <div
        aria-hidden="true"
        className={`absolute left-6 top-16 hidden h-[calc(100%-3rem)] w-px bg-white/[0.08] md:block ${last ? "md:hidden" : ""}`}
      />
      <div className="luxe-card h-full rounded-xl p-6">
        <div className="relative mb-6 flex h-16 items-end">
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 select-none font-display text-6xl italic leading-none text-white/[0.07]"
          >
            {number}
          </span>
          <div className="relative ml-14 flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
            <Icon className="h-5 w-5 text-gold" aria-hidden="true" />
          </div>
        </div>
        <h3 className="font-display text-xl tracking-normal">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </motion.div>
  );
}

function BrowserMock() {
  return (
    <div className="luxe-card w-full max-w-2xl overflow-hidden rounded-xl">
      {/* window chrome */}
      <div className="relative flex items-center justify-center border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="absolute left-4 flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <div className="glass-panel inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3 text-gold" aria-hidden="true" />
          lovify.app/p/atlas-store
        </div>
      </div>
      {/* storefront body */}
      <div className="flex aspect-[16/10]">
        <aside className="hidden w-1/5 flex-col gap-1.5 border-r border-white/[0.06] bg-white/[0.015] p-3 sm:flex">
          <div className="mb-3 h-2.5 w-16 rounded-full bg-white/20" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                i === 0 ? "border border-gold/25 bg-gold/[0.08]" : ""
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${i === 0 ? "bg-gold/70" : "bg-white/10"}`} />
              <span className={`h-2 flex-1 rounded-full ${i === 0 ? "bg-gold/40" : "bg-white/[0.06]"}`} />
            </div>
          ))}
        </aside>
        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex w-40 items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-[11px] text-muted-foreground sm:w-56">
              <Search className="h-3 w-3" aria-hidden="true" />
              Search products…
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="h-2 w-10 rounded-full bg-white/10" />
              <span className="h-7 w-7 rounded-full border border-white/10 bg-white/10" />
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
            {TILE_NAME_BARS.map((bar, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5"
              >
                <div className="flex-1 rounded-lg bg-white/[0.04]" />
                <div className={`h-2 rounded-full bg-white/15 ${bar}`} />
                <div className="h-2 w-1/3 rounded-full bg-white/[0.07]" />
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
  return (
    <motion.div
      variants={staggerItem}
      className={`luxe-card overflow-hidden rounded-xl transition-colors duration-300 ${
        index === 0 ? "lg:col-span-2 lg:row-span-1" : ""
      }`}
    >
      {/* window chrome */}
      <div className="relative flex items-center justify-center border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <div className="absolute left-3 flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <div className="glass-panel inline-flex max-w-[70%] items-center gap-1.5 rounded-full px-3 py-1 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0 text-gold" aria-hidden="true" />
          <span className="truncate">lovify.app/p/{app.slug}</span>
        </div>
      </div>
      {/* live preview */}
      <div className="relative aspect-[16/10] bg-white/[0.02]">
        {app.html ? (
          <ScaledThumb
            html={app.html}
            title={app.name}
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Sparkles className="h-8 w-8 text-white/15" aria-hidden="true" />
          </div>
        )}
        {/* overlay link */}
        <a
          href={`/p/${app.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${app.name}`}
          className="absolute inset-0 z-10 flex items-end justify-end bg-black/55 p-4 opacity-0 transition-opacity duration-300 hover:opacity-100 focus-visible:opacity-100"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-md">
            Open app <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </a>
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{app.name}</p>
          <p className="truncate text-xs text-muted-foreground">{app.description || "Built with Lovify"}</p>
        </div>
        <span className="shrink-0 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-gold">
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);
  const [liveApps, setLiveApps] = useState<LiveApp[] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="noise relative flex min-h-screen flex-col">
      {/* ------------------------------ navbar ------------------------------ */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-6">
          <BrandLogo size={24} />
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-8 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 md:flex"
          >
            <a href="#features" onClick={scrollToSection("features")} className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" onClick={scrollToSection("how-it-works")} className="transition-colors hover:text-foreground">
              How it works
            </a>
            <Link href="/explore" className="transition-colors hover:text-foreground">
              Explore
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {authed ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="h-9">
                  <Link href="/auth">
                    Start building
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </>
            )}
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-foreground transition hover:bg-white/[0.06] md:hidden"
            >
              {menuOpen ? <X className="h-4.5 w-4.5" aria-hidden="true" /> : <Menu className="h-4.5 w-4.5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* mobile slide-down menu */}
        <AnimatePresence>
          {menuOpen ? (
            <motion.nav
              key="mobile-menu"
              aria-label="Mobile navigation"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-b border-white/[0.06] bg-background/95 backdrop-blur-xl md:hidden"
            >
              <div className="space-y-1 px-5 py-4">
                <a
                  href="#features"
                  onClick={(e) => {
                    scrollToSection("features")(e);
                    closeMenu();
                  }}
                  className="block rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition hover:bg-white/[0.04] hover:text-foreground"
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  onClick={(e) => {
                    scrollToSection("how-it-works")(e);
                    closeMenu();
                  }}
                  className="block rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition hover:bg-white/[0.04] hover:text-foreground"
                >
                  How it works
                </a>
                <Link
                  href="/explore"
                  onClick={closeMenu}
                  className="block rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition hover:bg-white/[0.04] hover:text-foreground"
                >
                  Explore
                </Link>
                {!authed ? (
                  <Link
                    href="/auth"
                    onClick={closeMenu}
                    className="block rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition hover:bg-white/[0.04] hover:text-foreground"
                  >
                    Sign in
                  </Link>
                ) : null}
              </div>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </header>

      <main>
        {/* ------------------------------ hero ------------------------------ */}
        <section className="relative overflow-hidden pb-20 pt-32 sm:pt-40">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-grid" />
          </div>

          <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-6">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="eyebrow"
            >
              Powered by Z.AI
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
              className="mt-6 text-[2.85rem] leading-[1.02] tracking-tight sm:text-7xl"
            >
              <span className="font-semibold">Build apps at the</span>
              <br />
              <span className="font-display italic text-[1.1em]">speed of thought.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.16 }}
              className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg"
            >
              Describe what you want in plain words. Lovify’s Z.AI brain designs it, codes it and ships a real,
              working app in seconds — then you refine it by simply talking to it.
            </motion.p>

            {/* prompt box */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.24 }}
              className="relative mx-auto mt-10 max-w-3xl"
            >
              <div className="rounded-xl border border-white/10 bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] transition-colors duration-300 focus-within:border-gold/45">
                <div className="p-4 sm:p-5">
                  <Textarea
                    ref={textareaRef}
                    rows={3}
                    value={prompt}
                    disabled={creating}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitPrompt();
                      }
                    }}
                    placeholder="A CRM for my coffee shop with inventory, a kanban and sales charts…"
                    aria-label="Describe the app you want to build"
                    className="min-h-[84px] resize-none border-0 bg-transparent p-0 text-base shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-muted-foreground">
                        <Zap className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                        Z.AI · Fast model
                      </span>
                      <kbd className="hidden rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline-block">
                        Enter to build
                      </kbd>
                    </div>
                    <Button
                      onClick={submitPrompt}
                      disabled={creating}
                      className="gap-2"
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

            {/* example chips — swipeable on mobile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.32 }}
              className="marquee-mask mt-5 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
            >
              {EXAMPLE_PROMPTS.map((ex) => {
                const Icon = EXAMPLE_ICONS[ex.icon] ?? Sparkles;
                return (
                  <button
                    key={ex.icon}
                    type="button"
                    onClick={() => fillPrompt(ex.prompt)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-gold/35 hover:text-foreground"
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
        <section aria-label="Platform statistics" className="mt-4 border-y border-white/[0.06] py-14">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-12 gap-y-8 px-5 sm:gap-x-20 sm:px-6">
            <StatCounter target={stats ? stats.apps : null} failed={statsFailed} label="apps generated" />
            <span aria-hidden="true" className="hidden h-10 w-px bg-white/[0.08] sm:block" />
            <StatCounter target={stats ? stats.published : null} failed={statsFailed} label="apps published live" />
            <span aria-hidden="true" className="hidden h-10 w-px bg-white/[0.08] sm:block" />
            <StatCounter target={stats ? stats.builders : null} failed={statsFailed} label="builders creating" />
          </div>
        </section>

        {/* ----------------------------- features ----------------------------- */}
        <section id="features" className="scroll-mt-20 py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <p className="eyebrow">Everything included</p>
              <h2 className="mt-4 font-display text-4xl tracking-normal sm:text-5xl">A complete builder, not a toy</h2>
            </motion.div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="mt-12 grid gap-4 sm:mt-14 sm:gap-5 md:grid-cols-2 lg:grid-cols-3"
            >
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.title} icon={f.icon} title={f.title} text={f.text} index={i} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* --------------------------- how it works --------------------------- */}
        <section id="how-it-works" className="scroll-mt-20 py-24 sm:py-28">
          <div className="mx-auto max-w-5xl px-5 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <p className="eyebrow">How it works</p>
              <h2 className="mt-4 font-display text-4xl tracking-normal sm:text-5xl">From idea to live app in three moves</h2>
            </motion.div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="mt-12 grid gap-4 sm:mt-14 sm:gap-5 md:grid-cols-3"
            >
              {STEPS.map((s, i) => (
                <StepCard
                  key={s.title}
                  icon={s.icon}
                  title={s.title}
                  text={s.text}
                  number={`0${i + 1}`}
                  last={i === STEPS.length - 1}
                />
              ))}
            </motion.div>
          </div>
        </section>

        {/* ----------------------------- showcase ----------------------------- */}
        <section id="showcase" className="scroll-mt-20 py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <p className="eyebrow">See it in action</p>
              <h2 className="mt-4 font-display text-4xl tracking-normal sm:text-5xl">Real apps. Zero boilerplate.</h2>
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
              className="mt-12 sm:mt-14"
            >
              {liveApps === null ? (
                <div className="flex justify-center">
                  <BrowserMock />
                </div>
              ) : liveApps.length > 0 ? (
                <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {liveApps.map((app, i) => (
                    <LiveAppFrame key={app.slug} app={app} index={i} />
                  ))}
                </div>
              ) : (
                <div className="flex justify-center">
                  <BrowserMock />
                </div>
              )}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                <span className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-muted-foreground sm:text-sm">
                  <Zap className="h-4 w-4 text-gold" aria-hidden="true" />
                  avg build 38s
                </span>
                <span className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-muted-foreground sm:text-sm">
                  <LayoutGrid className="h-4 w-4 text-gold" aria-hidden="true" />
                  pixel-perfect responsive
                </span>
                <span className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-muted-foreground sm:text-sm">
                  <ShieldCheck className="h-4 w-4 text-gold" aria-hidden="true" />
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
        <section className="relative overflow-hidden py-24 text-center sm:py-28">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-1/2 mx-auto h-px max-w-lg bg-white/[0.07]" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto max-w-3xl px-5 sm:px-6"
          >
            <h2 className="text-4xl leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              <span className="font-semibold">Your next app is</span>{" "}
              <span className="font-display italic text-[1.1em]">one sentence away.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Type an idea. Get a working app. Refine it like a doc.
            </p>
            <div className="mt-9 flex justify-center">
              <Button asChild className="h-12 px-8 text-base">
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
      <footer className="mt-auto border-t border-white/[0.06] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-5 px-5 sm:px-6 md:flex-row">
          <div className="flex flex-col items-center gap-3 md:flex-row md:gap-4">
            <BrandLogo size={22} />
            <span className="text-center text-sm text-muted-foreground md:text-left">
              © {new Date().getFullYear()} Lovify — built with Z.AI
            </span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            <a href="#features" onClick={scrollToSection("features")} className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" onClick={scrollToSection("how-it-works")} className="transition-colors hover:text-foreground">
              How it works
            </a>
            <Link href="/explore" className="transition-colors hover:text-foreground">
              Explore
            </Link>
            <a
              href="https://github.com/faisukhan01/lovable"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" aria-hidden="true" />
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
