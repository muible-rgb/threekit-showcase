import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BandLabel } from "@/lib/scoring/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** One place to decide what a band looks like, used by every surface. */
export const BAND_STYLES: Record<
  BandLabel,
  { text: string; bg: string; ring: string; hex: string }
> = {
  Elite: { text: "text-elite", bg: "bg-elite/12", ring: "ring-elite/35", hex: "#d6ff3f" },
  Strong: { text: "text-strong", bg: "bg-strong/12", ring: "ring-strong/35", hex: "#6ee7a8" },
  Solid: { text: "text-solid", bg: "bg-solid/12", ring: "ring-solid/35", hex: "#7cc3ff" },
  "Below average": {
    text: "text-below",
    bg: "bg-below/12",
    ring: "ring-below/35",
    hex: "#ffb86b",
  },
  "At risk": { text: "text-risk", bg: "bg-risk/12", ring: "ring-risk/35", hex: "#ff7a7a" },
};

export function formatSigned(n: number, decimals = 1): string {
  const v = n.toFixed(decimals);
  return n > 0 ? `+${v}` : v;
}

/** 92.5 -> "92.5", 92 -> "92.0". The composite always shows its decimal. */
export function oneDecimal(n: number): string {
  return n.toFixed(1);
}

/**
 * Raw results, imperial. Every unit gets the shape people actually say out
 * loud: a mile is 7:42, an agility shuttle is 5.62s, a jump is 78".
 */
export function formatRaw(value: number, unit: string): string {
  switch (unit) {
    case "s":
      // Anything over a minute is a running time; under it is a stopwatch
      // reading, and the decimal matters.
      if (value >= 60) {
        const m = Math.floor(value / 60);
        const sec = Math.round(value - m * 60);
        return `${m}:${sec.toString().padStart(2, "0")}`;
      }
      return `${value.toFixed(2).replace(/\.?0+$/, "")}s`;
    case "reps":
      return String(Math.round(value));
    case "in": {
      const feet = Math.floor(value / 12);
      const inches = Math.round(value - feet * 12);
      return feet > 0 ? `${feet}'${inches}"` : `${Math.round(value)}"`;
    }
    case "ft":
      return `${Math.round(value)} ft`;
    case "lb":
      return `${Math.round(value)} lb`;
    case "points":
      return value.toFixed(1);
    default:
      return `${value} ${unit}`;
  }
}

/**
 * A change, in the unit it was measured in. A 148-second mile improvement is
 * "-2:28", not "-148.0" - the raw number is technically right and tells you
 * nothing at a glance.
 */
export function formatRawDelta(delta: number, unit: string): string {
  const sign = delta > 0 ? "+" : "-";
  const abs = Math.abs(delta);
  switch (unit) {
    case "s":
      if (abs >= 60) {
        const m = Math.floor(abs / 60);
        const sec = Math.round(abs - m * 60);
        return `${sign}${m}:${sec.toString().padStart(2, "0")}`;
      }
      return `${sign}${abs.toFixed(abs < 10 ? 2 : 1).replace(/\.?0+$/, "")}s`;
    case "reps":
      return `${sign}${Math.round(abs)}`;
    case "in":
      return `${sign}${Math.round(abs)}"`;
    case "ft":
      return `${sign}${Math.round(abs)} ft`;
    case "points":
      return `${sign}${abs.toFixed(1)}`;
    default:
      return `${sign}${abs}`;
  }
}

/** Seconds to m:ss, for the mile input. */
export function secondsToClock(total: number): { minutes: number; seconds: number } {
  const minutes = Math.floor(total / 60);
  return { minutes, seconds: Math.round(total - minutes * 60) };
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** The sentence that makes a percentile mean something to a human. */
export function betterThanSentence(percentile: number, sex: "M" | "F"): string {
  const group = sex === "M" ? "men" : "women";
  return `Better than ${Math.round(percentile)}% of ${group} your age`;
}

export function ageBandLabel(age: number, sex: "M" | "F"): string {
  const min = Math.floor(age / 5) * 5;
  return `${sex} ${min}-${min + 4}`;
}

/**
 * Did the raw number move the right way?
 *
 * Sign alone is not the answer: a faster 400m is a smaller number, so a
 * negative raw delta on the only lower-is-better test in the battery is an
 * improvement. Getting this backwards paints every PR on that test red, which
 * is exactly the kind of small wrongness that makes people stop trusting a
 * score card.
 */
export function rawImproved(
  direction: "higher_better" | "lower_better",
  rawDelta: number,
): boolean | null {
  if (rawDelta === 0) return null;
  return direction === "lower_better" ? rawDelta < 0 : rawDelta > 0;
}
