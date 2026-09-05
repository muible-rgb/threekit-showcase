"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * Asked once at the start because the farmer carry load is derived from it.
 * Skippable, because refusing to start a battery over a missing bodyweight
 * would be absurd - but then the carry has no load to prescribe, and the
 * screen says so rather than silently guessing.
 */
export function BodyweightPrompt({
  onSubmit,
  onSkip,
}: {
  onSubmit: (kg: number) => void | Promise<void>;
  onSkip: () => void;
}) {
  const [text, setText] = React.useState("");
  const kg = Number(text);
  const valid = text !== "" && Number.isFinite(kg) && kg >= 30 && kg <= 250;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-between px-5 py-10">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-faint">
          Before you start
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Bodyweight</h1>
        <p className="mt-2 text-sm leading-relaxed text-paper-dim">
          The farmer carry is loaded at half your bodyweight in each hand, so the
          app needs this to tell you what to pick up. It is not part of your
          score.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-baseline justify-center gap-2 rounded-3xl bg-ink py-8 ring-1 ring-ink-line">
          <input
            inputMode="decimal"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
            aria-label="Bodyweight in kilograms"
            className="score-hero tnum w-40 bg-transparent text-center text-[64px] outline-none placeholder:text-paper-faint"
          />
          <span className="text-2xl text-paper-faint">kg</span>
        </div>
        {valid && (
          <p className="text-center text-sm font-semibold text-signal">
            Carry load: {(kg / 2).toFixed(1)} kg per hand
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Button
          size="lg"
          className="w-full"
          disabled={!valid}
          onClick={() => onSubmit(kg)}
        >
          Start the battery
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full py-3 text-xs text-paper-faint hover:text-paper-dim"
        >
          Skip - I will work the carry load out myself
        </button>
      </div>
    </div>
  );
}
