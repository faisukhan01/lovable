"use client";

import Link from "next/link";

/**
 * Lovify brand mark — MONOLITH system.
 * Flat ivory square, hairline border, single engraved "L" glyph.
 * Wordmark set in Instrument Serif for an editorial, authored feel.
 */
export function BrandLogo({
  size = 28,
  withText = true,
  href = "/",
  className = "",
}: {
  size?: number;
  withText?: boolean;
  href?: string | null;
  className?: string;
}) {
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className="inline-flex items-center justify-center rounded-[22%] border border-white/15 bg-primary"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 64 64"
          width={size * 0.58}
          height={size * 0.58}
          fill="none"
          stroke="oklch(0.145 0 0)"
          strokeWidth={9}
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden="true"
        >
          <path d="M22 16v32h22" />
        </svg>
      </span>
      {withText ? (
        <span
          className="font-display leading-none text-foreground"
          style={{ fontSize: size * 0.93, letterSpacing: "0.01em" }}
        >
          Lovify
        </span>
      ) : null}
    </span>
  );

  if (!href) return inner;
  return (
    <Link
      href={href}
      aria-label="Lovify home"
      className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {inner}
    </Link>
  );
}
