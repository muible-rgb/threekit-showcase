import * as React from "react";
import { cn, BAND_STYLES } from "@/lib/utils";
import type { BandLabel } from "@/lib/scoring/types";

/**
 * "Below average" does not fit a narrow column at any readable size, so the
 * small variant uses a short form. The full label is used everywhere it fits,
 * and the title attribute carries it either way.
 */
const SHORT_LABELS: Partial<Record<BandLabel, string>> = {
  "Below average": "Below avg",
};

export function BandBadge({
  band,
  className,
  size = "md",
}: {
  band: BandLabel;
  className?: string;
  size?: "sm" | "md";
}) {
  const s = BAND_STYLES[band];
  const label = size === "sm" ? (SHORT_LABELS[band] ?? band) : band;
  return (
    <span
      title={band}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold uppercase tracking-wide ring-1",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-3 py-1 text-xs",
        s.text,
        s.bg,
        s.ring,
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Every percentile that comes from a provisional norms file carries this.
 * It links to the methodology page rather than hiding behind a tooltip only,
 * because the whole point is that the reader can go and check.
 */
export function ProvisionalTag({ slug, className }: { slug: string; className?: string }) {
  return (
    <a
      href={`/methodology#${slug}`}
      title="These norms are provisional. Tap to see the source and why."
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-below ring-1 ring-below/30 bg-below/10 hover:bg-below/20",
        className,
      )}
    >
      provisional
    </a>
  );
}

export function Chip({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-ink-line/60 px-2.5 py-1 text-xs font-medium text-paper-dim",
        className,
      )}
      {...props}
    />
  );
}
