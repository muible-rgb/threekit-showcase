"use client";

import * as React from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/data/store-context";

/**
 * A fresh install is seeded with the demo crew so no screen is ever empty.
 * That is useful for looking around and dishonest to leave unlabelled once
 * someone actually wants to test - so it says what it is, and gets out of the
 * way in one tap.
 */
export function DemoBanner() {
  const { db, store, refresh } = useStore();
  const [busy, setBusy] = React.useState(false);

  if (!db?.isDemo) return null;

  return (
    <div className="rounded-2xl bg-solid/8 p-4 ring-1 ring-solid/25">
      <p className="flex items-center gap-2 text-sm font-semibold text-solid">
        <FlaskConical size={15} /> Demo data
      </p>
      <p className="mt-1 text-xs text-paper-dim">
        A made-up crew of eight, so nothing is empty before you test.
      </p>
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
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await store.reset();
            refresh();
            setBusy(false);
          }}
        >
          <RotateCcw size={13} /> Reset
        </Button>
      </div>
    </div>
  );
}
