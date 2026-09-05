"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UNSCORED_MEASUREMENTS, type UnscoredKind } from "@/lib/battery";
import { useStore } from "@/lib/data/store-context";

/**
 * Captured in the same flow as the battery, stored, displayed, and never in
 * the composite. Sit-and-reach and heart rate recovery are genuinely useful
 * and genuinely not comparable across published norms, so they are kept
 * visibly outside the score rather than quietly folded into it.
 */
export function UnscoredPrompt({
  participantId,
  sessionId,
  onDone,
}: {
  participantId: string;
  sessionId: string | null;
  onDone: () => void;
}) {
  const { store, refresh } = useStore();
  const [values, setValues] = React.useState<Partial<Record<UnscoredKind, string>>>({});
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    const now = new Date().toISOString();
    for (const field of UNSCORED_MEASUREMENTS) {
      const raw = values[field.kind];
      if (raw === undefined || raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      await store.addUnscored({
        participantId,
        sessionId,
        kind: field.kind,
        value: n,
        recordedAt: now,
      });
    }
    refresh();
    setSaving(false);
    onDone();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-faint">
        Warm-down
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Three extra numbers</h1>
      <p className="mt-2 text-sm leading-relaxed text-paper-dim">
        These are stored and shown on your score, but they are not part of it.
        There is no age-and-sex norm we trust enough to grade them against.
      </p>

      <div className="mt-6 flex-1 space-y-5">
        {UNSCORED_MEASUREMENTS.filter((f) => f.kind !== "resting_hr").map((field) => (
          <label key={field.kind} className="block">
            <span className="text-sm font-semibold">{field.name}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-paper-faint">
              {field.when}
            </span>
            <div className="mt-2 flex items-center gap-3">
              <input
                inputMode="decimal"
                value={values[field.kind] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    [field.kind]: e.target.value.replace(/[^\d.-]/g, ""),
                  }))
                }
                className="tnum h-12 flex-1 rounded-xl bg-ink px-4 text-lg ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
              />
              <span className="w-10 text-sm text-paper-faint">{field.unit}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="pb-safe space-y-2 pt-6">
        <Button size="lg" className="w-full justify-between" onClick={save} disabled={saving}>
          <span>{saving ? "Saving..." : "See your score"}</span>
          <ArrowRight size={20} />
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="w-full py-3 text-xs text-paper-faint hover:text-paper-dim"
        >
          Skip these
        </button>
      </div>
    </div>
  );
}
