"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, createProject, login, signup } from "@/lib/api";
import { popPendingPrompt, stashPendingPrompt, useAuthStore } from "@/lib/store";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PERKS = ["Full apps from plain English", "Iterate by chatting", "Publish in one click"];

function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const skipGuardRef = useRef(false);

  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const token = useAuthStore((s) => s.token);

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);

  /* Route guard: already signed in -> leave the auth page. */
  useEffect(() => {
    if (!hasHydrated || skipGuardRef.current) return;
    if (token) {
      const target = nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard";
      router.replace(target);
    }
  }, [hasHydrated, token, nextParam, router]);

  const passwordTooShort = tab === "signup" && password.length > 0 && password.length < 6;

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (loading || booting) return;

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

      /* We handle the redirect ourselves (a pending prompt may exist). */
      skipGuardRef.current = true;
      useAuthStore.getState().setAuth(res.token, res.user);

      const pending = popPendingPrompt();
      if (pending) {
        setBooting(true);
        try {
          const project = await createProject(pending);
          router.replace(`/builder/${project.id}`);
        } catch {
          /* Give the idea a second chance: the dashboard picks the stash up
             and opens the create dialog pre-filled. */
          stashPendingPrompt(pending);
          toast.error("Couldn’t start your app — opening dashboard");
          router.replace("/dashboard");
        }
      } else {
        const target = nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard";
        router.replace(target);
      }
    } catch (err) {
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

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* --------------------------- left showcase --------------------------- */}
      <div className="relative hidden flex-col justify-center overflow-hidden border-r border-white/[0.06] px-14 lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-grid" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative max-w-lg"
        >
          <BrandLogo size={32} />
          <blockquote className="mt-12 font-display text-3xl italic leading-snug tracking-normal text-foreground">
            “I described a CRM over coffee. By the time I finished the cup, it was live.”
          </blockquote>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">— every Lovify user, basically</p>
          <ul className="mt-12 space-y-3">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/25 bg-gold/10">
                  <Check className="h-3 w-3 text-gold" aria-hidden="true" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* ------------------------------ form side ------------------------------ */}
      <div className="relative flex items-center justify-center px-6 py-16 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandLogo size={30} />
          </div>

          <div className="mb-6 text-center">
            <h1 className="font-display text-3xl tracking-normal">Welcome to Lovify</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Describe an idea — watch it become a working app.
            </p>
          </div>

          <div className="luxe-card rounded-xl p-6 sm:p-8">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              {/* sign in */}
              <TabsContent value="signin">
                <form onSubmit={handleAuth} className="mt-6 space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 w-full"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              {/* sign up */}
              <TabsContent value="signup">
                <form onSubmit={handleAuth} className="mt-6 space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Your name (optional)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    {passwordTooShort ? (
                      <p className="text-xs text-gold">Use at least 6 characters.</p>
                    ) : null}
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 w-full"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {loading ? "Creating account…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to home
            </Link>
          </div>
        </motion.div>
      </div>

      {/* --------------------- full-screen booting overlay --------------------- */}
      {booting ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/95 backdrop-blur"
        >
          <Loader2 className="h-8 w-8 animate-spin text-gold" aria-hidden="true" />
          <p className="font-display text-xl tracking-normal text-muted-foreground">Spinning up your app…</p>
        </div>
      ) : null}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AuthPanel />
    </Suspense>
  );
}
