"use client";

import * as React from "react";
import { Check, CloudOff, Loader2, TriangleAlert, HardDrive } from "lucide-react";
import { useStore } from "@/lib/data/store-context";
import { cn } from "@/lib/utils";

/**
 * Small, always visible, never modal. The one thing a user needs to know
 * during a session is "is my result safe", and the answer is always yes -
 * the indicator says where it is safe, not whether it is.
 */
export function SyncIndicator({ className }: { className?: string }) {
  const { sync } = useStore();
  const [expanded, setExpanded] = React.useState(false);

  const look = {
    synced: { Icon: Check, tone: "text-strong", label: "Synced" },
    pending: { Icon: Loader2, tone: "text-solid animate-spin", label: `${sync.pending}` },
    offline: { Icon: CloudOff, tone: "text-below", label: "Offline" },
    error: { Icon: TriangleAlert, tone: "text-risk", label: "Retry" },
    local_only: { Icon: HardDrive, tone: "text-paper-faint", label: "On device" },
  }[sync.state];

  const { Icon, tone, label } = look;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={`Storage status: ${sync.message}`}
        className="flex items-center gap-1.5 rounded-full bg-ink-raised px-2.5 py-1.5 text-[11px] font-medium text-paper-dim ring-1 ring-ink-line"
      >
        <Icon size={13} className={tone} />
        {label}
      </button>

      {expanded && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl bg-ink-raised p-3 text-xs leading-relaxed text-paper-dim shadow-xl ring-1 ring-ink-line">
          {sync.message}
        </div>
      )}
    </div>
  );
}
