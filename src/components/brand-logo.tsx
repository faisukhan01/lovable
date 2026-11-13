"use client";

import Link from "next/link";

/** Lovify brand mark: gradient rounded square + wordmark. Used across pages. */
export function BrandLogo({
  size = 30,
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
        className="relative inline-flex items-center justify-center rounded-[26%] shadow-lg shadow-black/40"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(135deg, #34d399 0%, #14b8a6 55%, #a3e635 100%)",
        }}
      >
        <svg
          viewBox="0 0 64 64"
          width={size * 0.62}
          height={size * 0.62}
          fill="none"
          stroke="#0c1210"
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 20h24L26 44h20" />
        </svg>
      </span>
      {withText ? (
        <span
          className="font-display font-bold tracking-tight text-foreground"
          style={{ fontSize: size * 0.72 }}
        >
          Lovify
        </span>
      ) : null}
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} aria-label="Lovify home" className="outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
      {inner}
    </Link>
  );
}
