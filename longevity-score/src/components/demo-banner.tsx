"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/data/store-context";

/**
 * A fresh install is seeded so no screen is ever empty. Useful, and dishonest
 * to leave unlabelled once someone wants to test for real.
 */
export function DemoBanner() {
  const { db, store, refresh } = useStore();
  const [busy, setBusy] = React.useState(false);

  if (!db?.isDemo) return null;

  return (
    <div className="mt-6 border-t border-rule-2 pt-4">
      <p className="label">Demo data</p>
      <p className="meta mt-1">A made-up crew of eight, so nothing is empty.</p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await store.clearDemo();
            refresh();
          }}
        >
          Clear it
        </Button>
        <Button
          size="sm"
          variant="quiet"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await store.reset();
            refresh();
            setBusy(false);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
