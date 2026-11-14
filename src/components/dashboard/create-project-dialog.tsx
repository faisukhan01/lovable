"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Gamepad2,
  ListTodo,
  Loader2,
  NotebookPen,
  Palette,
  ShoppingBag,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, createProject, enhancePrompt } from "@/lib/api";
import { EXAMPLE_PROMPTS } from "@/lib/examples";

const CHIP_ICONS: Record<string, LucideIcon> = {
  todo: ListTodo,
  portfolio: Palette,
  crm: BarChart3,
  game: Gamepad2,
  store: ShoppingBag,
  blog: NotebookPen,
};

const VIBES: { id: string; label: string; directive: string }[] = [
  {
    id: "dark",
    label: "Elegant dark",
    directive:
      "Design direction: premium flat dark theme, true black canvas, refined champagne-gold accents used sparingly, hairline borders, editorial serif display typography, rich micro-interactions.",
  },
  {
    id: "light",
    label: "Clean light",
    directive:
      "Design direction: clean light theme, airy whitespace, soft shadows, crisp modern typography.",
  },
  {
    id: "colorful",
    label: "Playful color",
    directive:
      "Design direction: playful and colorful, bold flat color blocks, rounded shapes, fun animations.",
  },
  {
    id: "minimal",
    label: "Ultra minimal",
    directive:
      "Design direction: ultra-minimal monochrome, generous whitespace, sharp typography, zero clutter.",
  },
];

/**
 * Shared "Describe your app" dialog with Z.AI prompt enhancement and
 * one-tap design vibes.
 */
export function CreateProjectDialog({
  open,
  onOpenChange,
  initialPrompt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Seed the draft when the dialog opens (e.g. a stashed pending prompt). */
  initialPrompt?: string | null;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [vibe, setVibe] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  // Seed the draft from initialPrompt, then reset when the dialog closes.
  useEffect(() => {
    if (open) {
      if (initialPrompt && !prompt) setPrompt(initialPrompt);
    } else {
      setPrompt("");
      setVibe(null);
    }
  }, [open, initialPrompt, prompt]);

  const vibeDirective = VIBES.find((v) => v.id === vibe)?.directive;

  async function handleEnhance() {
    const trimmed = prompt.trim();
    if (!trimmed || enhancing) return;
    setEnhancing(true);
    try {
      const res = await enhancePrompt(trimmed);
      const withVibe = vibeDirective ? `${res.prompt} ${vibeDirective}` : res.prompt;
      setPrompt(withVibe);
      toast.success("Prompt upgraded by Z.AI");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "The enhancer is busy. Try again in a moment."
      );
    } finally {
      setEnhancing(false);
    }
  }

  async function handleCreate() {
    const base = prompt.trim();
    if (!base || creating) return;
    const finalPrompt = vibeDirective ? `${base} ${vibeDirective}` : base;
    setCreating(true);
    try {
      const project = await createProject(finalPrompt);
      toast.success("Project created — Lovify is building it");
      onOpenChange(false);
      router.push(`/builder/${project.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not create the project. Please try again."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-normal">
            Describe your app
          </DialogTitle>
          <DialogDescription>
            One sentence is all it takes. Lovify designs and codes it for you,
            then you iterate by chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            autoFocus
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A booking site for my studio with a calendar, pricing cards and a gallery…"
            className="resize-none text-sm"
            aria-label="App description"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleCreate();
              }
            }}
          />

          {/* Z.AI prompt enhancer */}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleEnhance()}
              disabled={enhancing || prompt.trim().length < 8}
              className="gap-2 border-gold/25 bg-gold/10 text-gold hover:bg-gold/20 hover:text-gold"
            >
              {enhancing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <WandSparkles className="size-3.5" />
              )}
              Enhance with Z.AI
            </Button>
            <span className="text-[11px] text-muted-foreground">Ctrl + Enter to build</span>
          </div>

          {/* design vibes */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Vibe:</span>
            {VIBES.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={vibe === v.id}
                onClick={() => setVibe(vibe === v.id ? null : v.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  vibe === v.id
                    ? "border-gold/45 bg-gold/15 text-foreground"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-gold/35 hover:text-foreground"
                }`}
              >
                <Palette className="size-3 text-gold" />
                {v.label}
              </button>
            ))}
          </div>

          {/* templates */}
          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Start from a template
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EXAMPLE_PROMPTS.map((ex) => {
                const Icon = CHIP_ICONS[ex.icon] ?? Sparkles;
                return (
                  <button
                    key={ex.title}
                    type="button"
                    onClick={() => setPrompt(ex.prompt)}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors hover:border-gold/35"
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-3.5 shrink-0 text-gold" />
                      <span className="truncate text-xs font-medium">{ex.title}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[11px] leading-snug text-muted-foreground">
                      {ex.prompt}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !prompt.trim()}
          >
            {creating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Start building
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
