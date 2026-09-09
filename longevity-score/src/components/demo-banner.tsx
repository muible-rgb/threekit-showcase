"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/data/store-context";

/**
 * Lives on the Board, not the scorecard. Your own card is always genuinely
 * yours - registering is what creates it, the seed never signs anyone in
 * (see local-store.ts). What the seed does add is a crew of eight on the
 * board so it is not empty on a fresh install, and that is what this
 * discloses and clears.
 */
export function DemoBanner() {
  const { db, store, refresh } = useStore();
  const [busy, setBusy] = React.useState(false);

  if (!db?.isDemo) return null;

  return (
    <div className="mt-6 border-t border-rule-2 pt-4">
      <p className="label">Demo data</p>
      <p className="meta mt-1">
        A made-up crew of eight is on this board so it is not empty. Real
        people you invite show up alongside them.
      </p>
      <Button
        size="sm"
        className="mt-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await store.clearDemo();
          refresh();
        }}
      >
        {busy ? "Clearing" : "Clear the demo crew"}
      </Button>
    </div>
  );
}
