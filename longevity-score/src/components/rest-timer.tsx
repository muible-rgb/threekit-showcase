"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/utils";
import type { BatteryTest } from "@/lib/battery";

/**
 * Rest is part of the protocol, not a pause in it. Two to three minutes
 * between most tests, five before the 400m and the Cooper run - if people rest
 * less, the later results are a measure of their recovery rather than the
 * capacity being tested, and the whole battery stops being comparable.
 *
 * So the timer counts down, but it never blocks. Someone who is ready early
 * can go, and the screen tells them what that costs.
 */
export function RestTimer({
  seconds,
  justFinished,
  next,
  completed,
  total,
  onContinue,
}: {
  seconds: number;
  justFinished: BatteryTest;
  next: BatteryTest;
  completed: number;
  total: number;
  onContinue: () => void;
}) {
  const [remaining, setRemaining] = React.useState(seconds);
  const endsAt = React.useRef(Date.now() + seconds * 1000);

  React.useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, []);

  const ready = remaining === 0;
  const progress = 1 - remaining / seconds;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-between px-5 py-10">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-faint">
          {completed} of {total} done
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {justFinished.shortName} recorded
        </h1>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative flex h-56 w-56 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#232932" strokeWidth="4" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={ready ? "#6ee7a8" : "#d6ff3f"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${progress * 283} 283`}
              className="transition-[stroke-dasharray] duration-300"
            />
          </svg>
          <span className="score-hero tnum text-[56px]">
            {ready ? "Go" : formatClock(remaining)}
          </span>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[11px] uppercase tracking-widest text-paper-faint">Up next</p>
          <p className="mt-1 text-lg font-semibold">{next.name}</p>
          <p className="mt-1 text-sm text-paper-dim">{next.cue}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Button size="lg" className="w-full justify-between" onClick={onContinue}>
          <span>{ready ? `Start ${next.shortName}` : "Skip the rest"}</span>
          <ArrowRight size={20} />
        </Button>
      </div>
    </div>
  );
}
