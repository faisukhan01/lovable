"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import {
  ArrowRight,
  Bandage,
  BrainCircuit,
  ChartNoAxesColumn,
  Code2,
  Command,
  Copy,
  ExternalLink,
  Eye,
  Gamepad2,
  GitCompareArrows,
  GitFork,
  Github,
  Globe,
  Heart,
  HelpCircle,
  History,
  Keyboard,
  LayoutGrid,
  LayoutTemplate,
  Lightbulb,
  ListChecks,
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
  Settings,
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
import { ApiError, createProject, exploreApps, getStats } from "@/lib/api";
import { clearPendingPrompt, stashPendingPrompt, useAuthStore } from "@/lib/store";
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

/* The full inventory — 24 more capabilities beyond the flagship six. */
const MORE_FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: MessagesSquare,
    title: "Lovify Chat",
    text: "A standalone AI companion for brainstorming — no project needed.",
  },
  {
    icon: HelpCircle,
    title: "Ask mode",
    text: "Question your app's code without changing a single line.",
  },
  {
    icon: ListChecks,
    title: "Plan mode",
    text: "Get an implementation roadmap before committing to a build.",
  },
  {
    icon: Wand2,
    title: "Prompt enhancer",
    text: "One tap rewrites rough ideas into rich, specific briefs.",
  },
  {
    icon: Bandage,
    title: "One-tap fixes",
    text: "Quick actions for bugs, responsiveness, dark mode and SEO.",
  },
  {
    icon: GitCompareArrows,
    title: "Version diff",
    text: "Line-by-line diff between any two versions of your app.",
  },
  {
    icon: Code2,
    title: "Real code view",
    text: "Syntax-highlighted source with copy, download and AI notes.",
  },
  {
    icon: Lightbulb,
    title: "Explain this code",
    text: "Z.AI reads the file and teaches you how it works.",
  },
  {
    icon: MonitorSmartphone,
    title: "3 device previews",
    text: "Desktop, tablet and mobile frames, instantly switchable.",
  },
  {
    icon: History,
    title: "Restore anytime",
    text: "Roll back to any version with one click — nothing is lost.",
  },
  {
    icon: Keyboard,
    title: "Keyboard shortcuts",
    text: "⌘K command palette, ⌘S download, Enter to build.",
  },
  {
    icon: Command,
    title: "Command palette",
    text: "Search projects and run actions from anywhere.",
  },
  {
    icon: LayoutTemplate,
    title: "Templates",
    text: "Start from six battle-tested app blueprints.",
  },
  {
    icon: GitFork,
    title: "Remix any app",
    text: "Clone any published app into your workspace instantly.",
  },
  {
    icon: Heart,
    title: "Likes",
    text: "Love the apps you explore — and earn hearts on your own.",
  },
  {
    icon: Eye,
    title: "View counts",
    text: "Watch real traffic land on every published app.",
  },
  {
    icon: Search,
    title: "Explore search",
    text: "Filter the live gallery by name, idea or builder.",
  },
  {
    icon: UserRound,
    title: "Builder profiles",
    text: "Every builder gets a public page with their published apps.",
  },
  {
    icon: Copy,
    title: "Duplicate projects",
    text: "Branch an app into a copy without touching the original.",
  },
  {
    icon: Globe,
    title: "Unpublish",
    text: "Take any live app offline whenever you want.",
  },
  {
    icon: ChartNoAxesColumn,
    title: "Usage dashboard",
    text: "Track projects, versions, messages, likes and views.",
  },
  {
    icon: Settings,
    title: "Account settings",
    text: "Rename your profile, review usage, manage your session.",
  },
  {
    icon: ShieldCheck,
    title: "Sandboxed previews",
    text: "Generated apps run in a locked-down sandbox, always.",
  },
];

const TILE_NAME_BARS = ["w-3/4", "w-2/3", "w-4/5", "w-1/2", "w-3/5", "w-2/3"];

const MARQUEE_ITEMS = [
  "Prompt to product",
  "Refine by conversation",
  "Live preview",
  "Version history",
  "One-click publish",
  "Sandboxed previews",
  "Z.AI inside",
  "Zero config",
];

const DEFAULT_PLACEHOLDER =
  "A CRM for my coffee shop with inventory, a kanban and sales charts…";

const TYPE_PHRASES = [
  DEFAULT_PLACEHOLDER,
  "A habit tracker with streaks, stats and a moody dark dashboard…",
  "An invoice tracker for freelance clients with monthly revenue charts…",
  "A portfolio site with a project gallery, about page and contact form…",
];

const SPECKS: {
  left: string;
  top: string;
  size: number;
  dur: number;
  delay: number;
  gold: boolean;
}[] = [
  { left: "7%", top: "24%", size: 3, dur: 9, delay: 0, gold: true },
  { left: "15%", top: "62%", size: 2, dur: 12, delay: 1.2, gold: false },
  { left: "24%", top: "33%", size: 2.5, dur: 10, delay: 2.4, gold: true },
  { left: "34%", top: "74%", size: 2, dur: 11, delay: 0.6, gold: false },
  { left: "49%", top: "12%", size: 2, dur: 13, delay: 1.8, gold: true },
  { left: "59%", top: "68%", size: 3, dur: 9.5, delay: 0.9, gold: true },
  { left: "69%", top: "24%", size: 2, dur: 12.5, delay: 2.1, gold: false },
  { left: "77%", top: "56%", size: 2.5, dur: 10.5, delay: 1.4, gold: true },
  { left: "87%", top: "33%", size: 2, dur: 11.5, delay: 0.3, gold: false },
  { left: "93%", top: "68%", size: 3, dur: 9.8, delay: 2.6, gold: true },
];

/* --------------------------- animation ---------------------------- */

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const chipPop: Variants = {
  hidden: { opacity: 0, scale: 0.7, y: 12 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 20 },
  },
};

const dividerGrow: Variants = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
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

/** Cycles the prompt placeholder like an invisible hand typing ideas. */
function useTypewriter(active: boolean): string {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!active) return;
    let phrase = 0;
    let pos = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = TYPE_PHRASES[phrase];
      if (!deleting) {
        pos += 1;
        setText(current.slice(0, pos));
        if (pos >= current.length) {
          deleting = true;
          timer = setTimeout(tick, 2200);
          return;
        }
        timer = setTimeout(tick, 38 + Math.random() * 34);
      } else {
        pos -= 4;
        if (pos <= 0) {
          pos = 0;
          deleting = false;
          phrase = (phrase + 1) % TYPE_PHRASES.length;
          setText("");
          timer = setTimeout(tick, 600);
          return;
        }
        setText(current.slice(0, pos));
        timer = setTimeout(tick, 14);
      }
    };
    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, [active]);

  return text;
}

function scrollToSection(id: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

/* ------------------------- small components ----------------------- */

/** Four-point star used across the brand system. */
function SparkIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2c.7 5.2 4.8 9.3 10 10-5.2.7-9.3 4.8-10 10-.7-5.2-4.8-9.3-10-10 5.2-.7 9.3-4.8 10-10Z" />
    </svg>
  );
}

/** Thin gold reading-progress line pinned to the very top. */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 });
  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gold"
      style={{ scaleX }}
    />
  );
}

/** Word-by-word masked reveal with a soft focus pull. */
function MaskWords({
  text,
  delay = 0,
  stagger = 0.07,
  className = "",
}: {
  text: string;
  delay?: number;
  stagger?: number;
  className?: string;
}) {
  const words = text.split(" ");
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className={className}>
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            className="inline-block overflow-hidden pb-[0.1em] -mb-[0.1em] align-bottom"
          >
            <motion.span
              className="inline-block will-change-[transform,filter]"
              initial={{ y: "112%", opacity: 0, filter: "blur(8px)" }}
              animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: delay + i * stagger }}
            >
              {word}
              {i < words.length - 1 ? "\u00A0" : ""}
            </motion.span>
          </span>
        ))}
      </span>
    </>
  );
}

/** One full pass of the ticker content. */
function MarqueeRow({ hidden }: { hidden: boolean }) {
  return (
    <div aria-hidden={hidden} className="flex w-max shrink-0 items-center">
      {MARQUEE_ITEMS.map((item) => (
        <span key={item} className="flex items-center">
          <span className="whitespace-nowrap px-7 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-foreground">
            {item}
          </span>
          <SparkIcon className="h-2.5 w-2.5 shrink-0 text-gold/70" />
        </span>
      ))}
    </div>
  );
}

/** Infinite capability ticker — pauses when the reader looks at it. */
function MarqueeBand() {
  return (
    <div className="marquee-pausable marquee-mask overflow-hidden border-y border-white/[0.06] py-4">
      <div className="animate-marquee flex w-max">
        <MarqueeRow hidden={false} />
        <MarqueeRow hidden={true} />
      </div>
    </div>
  );
}

/** Subtle 3D tilt that follows the cursor. Disabled for reduced motion. */
function Tilt({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const reduce = !!useReducedMotion();
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [4.5, -4.5]), {
    stiffness: 160,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-4.5, 4.5]), {
    stiffness: 160,
    damping: 20,
  });

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        rawX.set((e.clientX - r.left) / r.width - 0.5);
        rawY.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        rawX.set(0);
        rawY.set(0);
      }}
      style={{ rotateX, rotateY, transformPerspective: 1100 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Gentle magnetic pull toward the cursor. */
function Magnetic({
  children,
  strength = 0.15,
  className = "",
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 180, damping: 16, mass: 0.4 });
  const y = useSpring(rawY, { stiffness: 180, damping: 16, mass: 0.4 });
  const reduce = !!useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      style={{ x, y, display: "inline-block" }}
      className={className}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        rawX.set((e.clientX - (r.left + r.width / 2)) * strength);
        rawY.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => {
        rawX.set(0);
        rawY.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

function StatCounter({ target, failed, label }: { target: number | null; failed: boolean; label: string }) {
  const display = useCountUp(target, failed);
  return (
    <motion.div variants={staggerItem} className="text-center">
      <div className="font-display text-5xl leading-none tracking-tight sm:text-6xl">{display}</div>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
    </motion.div>
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
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="luxe-card group rounded-xl p-6 transition-colors duration-300"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] transition-all duration-300 group-hover:scale-105 group-hover:border-gold/30">
        <Icon
          className="h-[18px] w-[18px] text-gold transition-transform duration-300 group-hover:rotate-[8deg] group-hover:scale-110"
          aria-hidden="true"
        />
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
      {/* connector rule — draws itself as you scroll */}
      <motion.div
        aria-hidden="true"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
        className={`absolute left-6 top-16 hidden h-[calc(100%-3rem)] w-px origin-top bg-white/[0.08] md:block ${last ? "md:hidden" : ""}`}
      />
      <div className="luxe-card h-full rounded-xl p-6 transition-colors duration-300">
        <div className="relative mb-6 flex h-16 items-end">
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 select-none font-display text-6xl italic leading-none text-white/[0.07]"
          >
            {number}
          </span>
          <div className="relative ml-14 flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] transition-all duration-300 group-hover:border-gold/30">
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
      className={`${index === 0 ? "lg:col-span-2 lg:row-span-1" : ""} h-full`}
    >
      <Tilt className="h-full">
        <div className="luxe-card flex h-full flex-col overflow-hidden rounded-xl transition-colors duration-300">
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
        </div>
      </Tilt>
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
  const [inputFocused, setInputFocused] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [nudgePrompt, setNudgePrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuOpenRef = useRef(false);
  const prefersReduced = !!useReducedMotion();

  /* False during SSR/hydration render, true afterwards — avoids auth-state
     hydration mismatch without calling setState inside an effect. */
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const token = useAuthStore((s) => s.token);
  const authed = mounted && !!token;

  /* navbar: slide away on scroll-down, return on scroll-up */
  const { scrollY } = useScroll();
  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);
  useMotionValueEvent(scrollY, "change", (y) => {
    if (menuOpenRef.current) return;
    const prev = scrollY.getPrevious() ?? 0;
    setNavHidden(y > prev && y > 140);
  });

  /* the prompt box types ideas on its own while idle */
  const typed = useTypewriter(prompt === "" && !creating && !inputFocused);

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

  /* Stash the idea and raise the inline sign-in card under the chat line. */
  const raiseSignInNudge = useCallback((value: string) => {
    stashPendingPrompt(value);
    setNudgePrompt(value);
    setNudgeOpen(true);
  }, []);

  const submitPrompt = useCallback(async () => {
    const value = prompt.trim();
    if (!value || creating) return;
    const currentToken = useAuthStore.getState().token;
    if (!currentToken) {
      /* Keep the user on the landing page: an animated card unfolds right
         under the chat line. The idea stays in the box AND is stashed —
         after sign-in the dashboard opens with it pre-filled. */
      raiseSignInNudge(value);
      return;
    }
    setCreating(true);
    try {
      const project = await createProject(value);
      clearPendingPrompt(); // idea shipped — drop any stale stash
      router.push(`/builder/${project.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        /* Session died mid-idea — keep the prompt so the dashboard picks it
           up right after the user signs back in. */
        raiseSignInNudge(value);
        return;
      }
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setCreating(false);
    }
  }, [prompt, creating, router, raiseSignInNudge]);

  const fillPrompt = (value: string) => {
    setPrompt(value);
    textareaRef.current?.focus();
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="noise relative flex min-h-screen flex-col">
      <ScrollProgress />

      {/* ------------------------------ navbar ------------------------------ */}
      <motion.header
        initial={{ y: -72, opacity: 0 }}
        animate={{ y: navHidden ? -72 : 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-background/75 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-6">
          <BrandLogo size={24} />
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-8 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 md:flex"
          >
            <a href="#features" onClick={scrollToSection("features")} className="nav-link transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" onClick={scrollToSection("how-it-works")} className="nav-link transition-colors hover:text-foreground">
              How it works
            </a>
            <Link href="/chat" className="nav-link transition-colors hover:text-foreground">
              Chat
            </Link>
            <Link href="/explore" className="nav-link transition-colors hover:text-foreground">
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
                  href="/chat"
                  onClick={closeMenu}
                  className="block rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition hover:bg-white/[0.04] hover:text-foreground"
                >
                  Chat
                </Link>
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
      </motion.header>

      <main>
        {/* ------------------------------ hero ------------------------------ */}
        <section className="relative overflow-hidden pb-20 pt-32 sm:pt-40">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="animate-grid-pan absolute inset-0 bg-grid" />
            {SPECKS.map((s, i) => (
              <span
                key={i}
                className={`speck ${s.gold ? "speck-gold" : "speck-mist"}`}
                style={
                  {
                    left: s.left,
                    top: s.top,
                    width: s.size,
                    height: s.size,
                    "--speck-dur": `${s.dur}s`,
                    "--speck-delay": `${s.delay}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>

          <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-6">
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="eyebrow inline-flex items-center gap-2"
            >
              <motion.span
                className="inline-flex"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.3 }}
              >
                <SparkIcon className="pulse-soft h-3 w-3" />
              </motion.span>
              Powered by Z.AI
            </motion.p>

            <h1 className="mt-6 text-[2.85rem] leading-[1.02] tracking-tight sm:text-7xl">
              <MaskWords text="Build apps at the" delay={0.14} className="font-semibold" />
              <br />
              <MaskWords text="speed of thought." delay={0.46} className="font-display italic text-[1.1em]" />
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.52 }}
              className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg"
            >
              Describe what you want in plain words. Lovify’s Z.AI brain designs it, codes it and ships a real,
              working app in seconds — then you refine it by simply talking to it.
            </motion.p>

            {/* prompt box */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.62 }}
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
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitPrompt();
                      }
                    }}
                    placeholder={typed || DEFAULT_PLACEHOLDER}
                    aria-label="Describe the app you want to build"
                    className="min-h-[84px] resize-none border-0 bg-transparent p-0 text-base shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-muted-foreground">
                        <Zap className="pulse-soft h-3.5 w-3.5 text-gold" aria-hidden="true" />
                        Z.AI · Fast model
                      </span>
                      <kbd className="hidden rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline-block">
                        Enter to build
                      </kbd>
                    </div>
                    <Button
                      onClick={submitPrompt}
                      disabled={creating}
                      className="group/btn relative gap-2 overflow-hidden"
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 -translate-x-[170%] skew-x-12 bg-white/[0.16] transition-transform duration-[900ms] ease-out group-hover/btn:translate-x-[170%]"
                      />
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

              {/* inline sign-in nudge — unfolds in the middle, under the chat line */}
              <AnimatePresence>
                {nudgeOpen && !authed ? (
                  <motion.div
                    key="signin-nudge"
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, y: -14, scale: 0.955, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -8, scale: 0.97, filter: "blur(4px)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="relative mt-4 overflow-hidden rounded-xl border border-gold/30 bg-card text-left shadow-[0_30px_80px_-28px_rgba(0,0,0,0.95)]"
                  >
                    {/* gold hairline draws itself across the top edge */}
                    <motion.span
                      aria-hidden="true"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
                      className="absolute inset-x-0 top-0 h-px origin-left bg-gold/60"
                    />

                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
                      <motion.span
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 17, delay: 0.08 }}
                        className="pulse-soft inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10"
                      >
                        <Lock className="h-5 w-5 text-gold" aria-hidden="true" />
                      </motion.span>

                      <div className="min-w-0 flex-1">
                        <motion.p
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.14 }}
                          className="eyebrow"
                        >
                          Idea saved
                        </motion.p>
                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                          className="mt-1.5 font-display text-xl tracking-normal sm:text-2xl"
                        >
                          Sign in to start building
                        </motion.p>
                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.26 }}
                          className="mt-1.5 text-sm leading-relaxed text-muted-foreground"
                        >
                          Your prompt is safe — it will be waiting on your dashboard the
                          moment you are in.
                        </motion.p>
                        <AnimatePresence>
                          {nudgePrompt ? (
                            <motion.p
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.32 }}
                              className="mt-3 truncate border-l-2 border-gold/40 pl-3 font-display text-sm italic text-zinc-300"
                            >
                              &ldquo;{nudgePrompt}&rdquo;
                            </motion.p>
                          ) : null}
                        </AnimatePresence>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                        className="flex shrink-0 flex-col-reverse gap-2 max-sm:grid max-sm:grid-cols-2 sm:flex-row sm:items-center"
                      >
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-9 border-gold/30 bg-gold/[0.06] text-gold hover:bg-gold/15 hover:text-gold"
                        >
                          <Link href="/auth">Create free account</Link>
                        </Button>
                        <Button asChild size="sm" className="h-9">
                          <Link href="/auth">
                            Sign in
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </Button>
                      </motion.div>
                    </div>

                    <button
                      type="button"
                      aria-label="Dismiss sign-in reminder"
                      onClick={() => setNudgeOpen(false)}
                      className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>

            {/* example chips — swipeable on mobile */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="marquee-mask mt-5 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
            >
              {EXAMPLE_PROMPTS.map((ex) => {
                const Icon = EXAMPLE_ICONS[ex.icon] ?? Sparkles;
                return (
                  <motion.button
                    key={ex.icon}
                    variants={chipPop}
                    type="button"
                    onClick={() => fillPrompt(ex.prompt)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-gold/35 hover:text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {ex.title}
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* --------------------------- marquee band --------------------------- */}
        <MarqueeBand />

        {/* ---------------------------- stats band ---------------------------- */}
        <section aria-label="Platform statistics" className="border-b border-white/[0.06] py-14">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-12 gap-y-8 px-5 sm:gap-x-20 sm:px-6"
          >
            <StatCounter target={stats ? stats.apps : null} failed={statsFailed} label="apps generated" />
            <motion.span variants={dividerGrow} aria-hidden="true" className="hidden h-10 w-px bg-white/[0.08] sm:block" />
            <StatCounter target={stats ? stats.published : null} failed={statsFailed} label="apps published live" />
            <motion.span variants={dividerGrow} aria-hidden="true" className="hidden h-10 w-px bg-white/[0.08] sm:block" />
            <StatCounter target={stats ? stats.builders : null} failed={statsFailed} label="builders creating" />
          </motion.div>
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

        {/* --------------------------- feature wall --------------------------- */}
        <section id="everything" className="scroll-mt-20 pb-24 sm:pb-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <p className="eyebrow">And that is not all</p>
              <h2 className="mt-4 font-display text-4xl tracking-normal sm:text-5xl">
                Thirty features. One prompt away.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Everything below is already inside Lovify — chat-only AI, coding tools,
                community, and platform power taken from the best of Lovable, Base44 and Claude Code.
              </p>
            </motion.div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {MORE_FEATURES.map((f) => (
                <motion.div
                  key={f.title}
                  variants={staggerItem}
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="luxe-card group rounded-xl p-4"
                >
                  <div className="flex items-center gap-2">
                    <f.icon
                      className="size-4 text-gold transition-transform duration-300 group-hover:scale-110"
                      aria-hidden="true"
                    />
                    <h3 className="text-sm font-medium">{f.title}</h3>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.text}</p>
                </motion.div>
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
                <motion.div
                  animate={prefersReduced ? undefined : { y: [0, -10, 0] }}
                  transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                  className="flex w-full justify-center"
                >
                  <BrowserMock />
                </motion.div>
              ) : liveApps.length > 0 ? (
                <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {liveApps.map((app, i) => (
                    <LiveAppFrame key={app.slug} app={app} index={i} />
                  ))}
                </div>
              ) : (
                <motion.div
                  animate={prefersReduced ? undefined : { y: [0, -10, 0] }}
                  transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                  className="flex w-full justify-center"
                >
                  <BrowserMock />
                </motion.div>
              )}
              <motion.div variants={staggerItem} className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
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
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* -------------------------------- CTA -------------------------------- */}
        <section className="relative overflow-hidden py-24 text-center sm:py-28">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <SparkIcon className="animate-spin-slow absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 text-gold/[0.06] sm:h-96 sm:w-96" />
            <div className="absolute inset-x-0 top-1/2 mx-auto h-px max-w-lg bg-white/[0.07]" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto max-w-3xl px-5 sm:px-6"
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.1 }}
              className="mb-8 flex justify-center"
            >
              <BrandLogo size={46} withText={false} href={null} />
            </motion.div>
            <h2 className="text-4xl leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              <span className="font-semibold">Your next app is</span>{" "}
              <span className="font-display italic text-[1.1em]">one sentence away.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Type an idea. Get a working app. Refine it like a doc.
            </p>
            <div className="mt-9 flex justify-center">
              <Magnetic>
                <Button asChild className="group/btn relative h-12 overflow-hidden px-8 text-base">
                  <Link href="/auth">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -translate-x-[170%] skew-x-12 bg-white/[0.16] transition-transform duration-[900ms] ease-out group-hover/btn:translate-x-[170%]"
                    />
                    <Sparkles className="relative mr-2 h-5 w-5" aria-hidden="true" />
                    Start building free
                  </Link>
                </Button>
              </Magnetic>
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
              © {new Date().getFullYear()} Lovify · built by{" "}
              <a
                href="https://github.com/faisukhan01"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-gold/90 underline-offset-4 transition-colors hover:text-gold hover:underline"
              >
                Faisal
              </a>
              {" "}· powered by Z.AI
            </span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            <a href="#features" onClick={scrollToSection("features")} className="nav-link transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" onClick={scrollToSection("how-it-works")} className="nav-link transition-colors hover:text-foreground">
              How it works
            </a>
            <Link href="/chat" className="nav-link transition-colors hover:text-foreground">
              Chat
            </Link>
            <Link href="/explore" className="nav-link transition-colors hover:text-foreground">
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
