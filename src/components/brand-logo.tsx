"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/**
 * Lovify brand mark — MONOLITH system.
 * Flat ivory square, hairline border, engraved "L" glyph, and a
 * champagne-gold four-point spark notched into the top-right corner.
 * The spark pops in with a spring on mount and pivots on hover.
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
    <span className={`group inline-flex items-center gap-2.5 ${className}`}>
      <motion.span
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="relative inline-flex items-center justify-center rounded-[22%] border border-white/15 bg-primary"
        style={{ width: size, height: size }}
      >
        {/* engraved L */}
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
        {/* signature spark — spring pop on mount, pivots on hover */}
        <motion.svg
          viewBox="0 0 24 24"
          width={Math.max(8, size * 0.4)}
          height={Math.max(8, size * 0.4)}
          className="pointer-events-none absolute origin-center transition-all duration-300 ease-out group-hover:rotate-90 group-hover:scale-110"
          style={{ top: -size * 0.1, right: -size * 0.1 }}
          initial={{ scale: 0, rotate: -120, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 15, delay: 0.25 }}
          aria-hidden="true"
        >
          <path
            d="M12 2c.7 5.2 4.8 9.3 10 10-5.2.7-9.3 4.8-10 10-.7-5.2-4.8-9.3-10-10 5.2-.7 9.3-4.8 10-10Z"
            fill="oklch(0.81 0.09 85)"
          />
        </motion.svg>
      </motion.span>
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
