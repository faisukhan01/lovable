import Link from "next/link";
import { Compass, Home } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="noise flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <BrandLogo size={26} />
      <p className="eyebrow mt-10 font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
        Error 404
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-normal text-foreground sm:text-5xl">
        Lost in the monolith
      </h1>
      <p className="mt-4 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
        This page does not exist — or it was moved while you weren&apos;t
        looking. Your apps are exactly where you left them.
      </p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button asChild className="gap-2">
          <Link href="/">
            <Home className="size-4" aria-hidden="true" />
            Back to home
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/explore">
            <Compass className="size-4" aria-hidden="true" />
            Explore apps
          </Link>
        </Button>
      </div>
    </div>
  );
}
