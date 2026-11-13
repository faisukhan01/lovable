"use client";

import { useEffect, useState } from "react";

/** Rotating status labels shown while Lovify (Z.AI) is building. */
export const BUILDING_LABELS = [
  "Analyzing your request…",
  "Designing the interface…",
  "Writing the code…",
  "Assembling the app…",
  "Polishing pixels…",
] as const;

export function RotatingLabel({
  intervalMs = 2200,
  className,
}: {
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % BUILDING_LABELS.length),
      intervalMs
    );
    return () => clearInterval(timer);
  }, [intervalMs]);

  return (
    <span className={className} aria-live="polite">
      {BUILDING_LABELS[index]}
    </span>
  );
}
