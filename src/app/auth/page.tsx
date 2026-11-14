"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, login, signup } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { BrandLogo } from "@/components/brand-logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ------------------------------ copy ------------------------------ */

const QUOTES = [
  {
    text: "I described a CRM over coffee. By the time I finished the cup, it was live.",
    author: "every Lovify user, basically",
  },
  {
    text: "No scaffolding. No boilerplate. Just the sentence in my head, running.",
    author: "the whole pitch, honestly",
  },
  {
    text: "It feels less like coding and more like the app already existed.",
    author: "a builder, day one",
  },
];

const PERKS = [
  "Full apps from plain English",
  "Iterate by chatting",
  "Publish in one click",
];

const EASE = [0.22, 1, 0.36, 1] as const;

/* --------------------------- field shell --------------------------- */

function Field({
  id,
  label,
  icon: Icon,
  children,
  delay,
}: {
  id: string;
  label: string;
  icon: typeof Mail;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className="space-y-2"
    >
      <Label htmlFor={id} className="text-xs text-zinc-400">
        {label}
      </Label>
      <div className="group relative">
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600 transition-colors duration-300 group-focus-within:text-gold"
        />
        {children}
      </div>
    </motion.div>
  );
}

const inputClasses =
  "h-11 rounded-lg border-white/10 bg-white/[0.03] pl-10 text-sm text-foreground placeholder:text-zinc-600 transition-all duration-300 focus-visible:border-gold/50 focus-visible:ring-4 focus-visible:ring-gold/10";

/* ------------------------------ panel ------------------------------ */

function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const skipGuardRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const shake = useAnimationControls();

  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const token = useAuthStore((s) => s.token);

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  /* Route guard: already signed in -> leave the auth page. */
  useEffect(() => {
    if (!hasHydrated || skipGuardRef.current) return;
    if (token) {
      const target = nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard";
      router.replace(target);
    }
  }, [hasHydrated, token, nextParam, router]);

  /* Rotating showcase quotes (paused for reduced motion). */
  const [quoteIndex, setQuoteIndex] = useState(0);
  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(
      () => setQuoteIndex((i) => (i + 1) % QUOTES.length),
      5400
    );
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const passwordTooShort = tab === "signup" && password.length > 0 && password.length < 6;

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res =
        tab === "signin"
          ? await login(trimmedEmail, password)
          : await signup(trimmedEmail, password, name.trim() || undefined);

      /* We handle the redirect ourselves. Any prompt stashed on the landing
         page stays stashed — the dashboard opens the builder dialog with it
         pre-filled, so the idea is never lost. */
      skipGuardRef.current = true;
      useAuthStore.getState().setAuth(res.token, res.user);

      const target = nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard";
      router.replace(target);
    } catch (err) {
      void shake.start({
        x: [0, -10, 10, -6, 6, 0],
        transition: { duration: 0.42, ease: "easeInOut" },
      });
      if (err instanceof ApiError && err.status === 409) {
        /* Duplicate email on signup — guide them to sign in instead of
           leaving them stuck between both tabs. */
        setTab("signin");
        setEmail(trimmedEmail);
        setPassword("");
        toast.error("This email already has an account — sign in instead.");
      } else {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  const isSignin = tab === "signin";

  return (
    <div className="noise relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* ---------------------- ambient backdrop ---------------------- */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid" />
        <motion.div
          className="absolute -left-40 top-[-20%] size-[560px] rounded-full bg-gold opacity-[0.05] blur-[140px]"
          animate={reduceMotion ? undefined : { x: [0, 70, -30, 0], y: [0, -40, 30, 0] }}
          transition={reduceMotion ? undefined : { duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-30%] right-[-15%] size-[620px] rounded-full bg-gold opacity-[0.04] blur-[160px]"
          animate={reduceMotion ? undefined : { x: [0, -60, 40, 0], y: [0, 50, -30, 0] }}
          transition={reduceMotion ? undefined : { duration: 32, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* slow-orbiting hairline ring with a lone gold satellite */}
        <motion.div
          className="absolute right-[-120px] top-[-120px] size-[380px] rounded-full border border-white/[0.07] sm:right-[6%] sm:top-[10%]"
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={reduceMotion ? undefined : { duration: 70, repeat: Infinity, ease: "linear" }}
        >
          <span className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow-[0_0_12px_oklch(0.81_0.09_85)]" />
        </motion.div>
        <motion.span
          aria-hidden="true"
          className="absolute left-[8%] top-[18%] hidden font-mono text-lg text-gold/30 lg:block"
          animate={reduceMotion ? undefined : { y: [0, -10, 0], opacity: [0.2, 0.45, 0.2] }}
          transition={reduceMotion ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          +
        </motion.span>
        <motion.span
          aria-hidden="true"
          className="absolute bottom-[14%] left-[42%] hidden font-mono text-sm text-white/15 lg:block"
          animate={reduceMotion ? undefined : { y: [0, 8, 0], opacity: [0.1, 0.3, 0.1] }}
          transition={reduceMotion ? undefined : { duration: 7.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        >
          +
        </motion.span>
      </div>

      {/* --------------------------- content --------------------------- */}
      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-16">
        {/* --------------------- left: the showcase --------------------- */}
        <motion.section
          aria-hidden={undefined}
          className="hidden flex-col lg:flex"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
          }}
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}>
            <BrandLogo size={30} />
          </motion.div>

          <motion.p
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }}
            className="eyebrow mt-14"
          >
            Lovify — build at the speed of thought
          </motion.p>

          <motion.h2
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } } }}
            className="mt-4 font-display text-5xl leading-[1.08] tracking-normal text-foreground xl:text-6xl"
          >
            Describe it once.
            <br />
            <span className="italic text-gold">Watch it exist.</span>
          </motion.h2>

          {/* rotating quotes */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }}
            className="mt-12 min-h-[120px] max-w-md border-l-2 border-gold/40 pl-5"
          >
            <AnimatePresence mode="wait">
              <motion.blockquote
                key={quoteIndex}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <p className="font-display text-xl italic leading-snug text-zinc-200">
                  &ldquo;{QUOTES[quoteIndex].text}&rdquo;
                </p>
                <footer className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  — {QUOTES[quoteIndex].author}
                </footer>
              </motion.blockquote>
            </AnimatePresence>
          </motion.div>

          <motion.ul
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } } }}
            className="mt-10 space-y-3"
          >
            {PERKS.map((perk) => (
              <motion.li
                key={perk}
                variants={{ hidden: { opacity: 0, x: -14 }, visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE } } }}
                className="flex items-center gap-3 text-sm text-zinc-400"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-gold/25 bg-gold/10">
                  <Check className="size-3 text-gold" aria-hidden="true" />
                </span>
                {perk}
              </motion.li>
            ))}
          </motion.ul>

          <motion.p
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.8, delay: 0.9 } } }}
            className="mt-12 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-600"
          >
            Powered by Z.AI · 20+ superpowers · one sentence away
          </motion.p>
        </motion.section>

        {/* ---------------------- right: the form ---------------------- */}
        <div className="w-full justify-self-center">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE, delay: 0.15 }}
          >
            <motion.div animate={shake} className="mx-auto w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <BrandLogo size={28} />
            </div>

            <div className="glass-panel relative overflow-hidden rounded-2xl p-6 shadow-[0_24px_80px_-24px_oklch(0_0_0/0.8)] sm:p-8">
              {/* hairline gold crown on the card */}
              <span
                aria-hidden="true"
                className="absolute inset-x-8 top-0 h-px bg-gold/40"
              />

              {/* heading — swaps with the tab */}
              <div className="mb-6 text-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.28, ease: EASE }}
                  >
                    <h1 className="font-display text-3xl tracking-normal text-foreground">
                      {isSignin ? "Welcome back" : "Create your account"}
                    </h1>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {isSignin
                        ? "Your builder is right where you left it."
                        : "One sentence is all it takes — watch it become an app."}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* animated tab switcher — gold pill slides */}
              <div
                role="tablist"
                aria-label="Sign in or create account"
                className="relative grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.03] p-1"
              >
                {(
                  [
                    ["signin", "Sign in"],
                    ["signup", "Create account"],
                  ] as const
                ).map(([value, label]) => {
                  const active = tab === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(value)}
                      className={`relative min-h-9 rounded-lg px-4 py-1.5 text-sm transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                        active ? "text-foreground" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="auth-tab-pill"
                          className="absolute inset-0 rounded-lg border border-gold/30 bg-gold/15"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className="relative z-10">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* forms — slide/fade between tabs */}
              <form onSubmit={handleAuth} noValidate className="mt-6">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -18 }}
                    transition={{ duration: 0.28, ease: EASE }}
                    className="space-y-4"
                  >
                    {!isSignin && (
                      <Field id="name" label="Name" icon={User} delay={0.02}>
                        <Input
                          id="name"
                          type="text"
                          autoComplete="name"
                          placeholder="Your name (optional)"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={`${inputClasses} pl-10`}
                        />
                      </Field>
                    )}

                    <Field id="email" label="Email" icon={Mail} delay={0.06}>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={inputClasses}
                      />
                    </Field>

                    <Field id="password" label="Password" icon={Lock} delay={0.1}>
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={isSignin ? "current-password" : "new-password"}
                        placeholder={isSignin ? "Your password" : "At least 6 characters"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={`${inputClasses} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-600 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Eye className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    </Field>

                    {passwordTooShort ? (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-gold"
                      >
                        Use at least 6 characters.
                      </motion.p>
                    ) : null}

                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: EASE, delay: 0.14 }}
                      className="pt-1"
                    >
                      <motion.button
                        type="submit"
                        disabled={loading}
                        whileHover={loading ? undefined : { y: -1 }}
                        whileTap={loading ? undefined : { scale: 0.985 }}
                        transition={{ duration: 0.18, ease: EASE }}
                        className="group flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gold text-sm font-semibold text-black shadow-[0_8px_28px_-10px_oklch(0.81_0.09_85/0.5)] transition-opacity hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                        {loading
                          ? isSignin
                            ? "Signing in…"
                            : "Creating account…"
                          : isSignin
                            ? "Sign in"
                            : "Create account"}
                        {!loading && (
                          <ArrowRight
                            className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        )}
                      </motion.button>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </form>

              <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-600">
                By continuing you agree to build wonderful things.
                <br className="sm:hidden" /> No credit card, no setup — just Z.AI.
              </p>
            </div>

            <div className="mt-6 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to home
              </Link>
            </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-6 animate-spin text-gold" aria-label="Loading" />
        </div>
      }
    >
      <AuthPanel />
    </Suspense>
  );
}
