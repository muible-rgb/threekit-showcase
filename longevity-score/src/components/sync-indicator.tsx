"use client";

import { useStore } from "@/lib/data/store-context";

/** State as a word, not an icon. */
const WORDS: Record<string, string> = {
  synced: "Synced",
  pending: "Syncing",
  offline: "Offline",
  error: "Retry",
  local_only: "On device",
};

export function SyncIndicator() {
  const { sync } = useStore();
  return (
    <span className="meta" title={sync.message}>
      {WORDS[sync.state] ?? sync.state}
      {sync.pending > 0 ? ` ${sync.pending}` : ""}
    </span>
  );
}
