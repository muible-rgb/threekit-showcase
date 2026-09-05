"use client";

import * as React from "react";
import { Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BatteryTest } from "@/lib/battery";

/**
 * One input per unit, because a stepper for reps and a number pad for
 * centimetres are not the same interaction, and getting this wrong costs a
 * retest. Every one of these is designed to be usable one-handed while the
 * other hand is holding a stopwatch or a dumbbell.
 */

export function TestInput({
  test,
  value,
  onChange,
}: {
  test: BatteryTest;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  switch (test.input) {
    case "timer":
      return <TimerInput test={test} value={value} onChange={onChange} />;
    case "stepper":
      return <StepperInput test={test} value={value} onChange={onChange} />;
    case "half_step":
      return <HalfStepInput onChange={onChange} />;
    default:
      return <NumberPadInput test={test} value={value} onChange={onChange} />;
  }
}

/* ------------------------------------------------------------------ timer */

function TimerInput({
  test,
  value,
  onChange,
}: {
  test: BatteryTest;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [running, setRunning] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const startedRef = React.useRef<number | null>(null);
  const baseRef = React.useRef(0);

  // Elapsed time is derived from wall clock, never accumulated from ticks.
  // A phone that sleeps mid-wall-sit must not lose the seconds it slept.
  React.useEffect(() => {
    if (!running) return;
    let frame: number;
    const tick = () => {
      const started = startedRef.current;
      if (started !== null) {
        setElapsed(baseRef.current + (Date.now() - started) / 1000);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  const cap = test.slug === "single_leg_balance_eyes_closed" ? 60 : null;
  const capped = cap !== null && elapsed >= cap;

  React.useEffect(() => {
    if (capped && running) {
      setRunning(false);
      baseRef.current = cap!;
      setElapsed(cap!);
      onChange(cap!);
    }
  }, [capped, running, cap, onChange]);

  function start() {
    startedRef.current = Date.now();
    setRunning(true);
  }

  function stop() {
    const started = startedRef.current;
    const total = started === null ? elapsed : baseRef.current + (Date.now() - started) / 1000;
    baseRef.current = total;
    startedRef.current = null;
    setRunning(false);
    setElapsed(total);
    onChange(Math.round(total * 10) / 10);
  }

  function reset() {
    baseRef.current = 0;
    startedRef.current = null;
    setRunning(false);
    setElapsed(0);
    onChange(null);
  }

  const shown = value !== null && !running ? value : elapsed;
  const minutes = Math.floor(shown / 60);
  const seconds = shown - minutes * 60;

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "flex h-40 items-center justify-center rounded-3xl bg-ink ring-1 ring-ink-line",
          running && "running ring-signal/60",
        )}
      >
        <span className="score-hero tnum text-[68px]">
          {minutes > 0 ? `${minutes}:${seconds.toFixed(1).padStart(4, "0")}` : seconds.toFixed(1)}
        </span>
        <span className="ml-2 self-end pb-4 text-lg text-paper-faint">
          {minutes > 0 ? "" : "s"}
        </span>
      </div>

      {cap !== null && (
        <p className="text-center text-xs text-paper-faint">
          {capped
            ? `Capped at ${cap}s. Everyone who reaches the cap scores the same.`
            : `Stops automatically at ${cap}s.`}
        </p>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Button
          size="lg"
          variant={running ? "danger" : "primary"}
          onClick={running ? stop : start}
          className="text-xl"
        >
          {running ? (
            <>
              <Pause size={22} /> Stop
            </>
          ) : (
            <>
              <Play size={22} /> {value !== null || elapsed > 0 ? "Resume" : "Start"}
            </>
          )}
        </Button>
        <Button size="lg" variant="secondary" onClick={reset} aria-label="Reset timer">
          <RotateCcw size={20} />
        </Button>
      </div>

      <details className="text-center">
        <summary className="cursor-pointer text-xs text-paper-faint">
          Enter a time by hand instead
        </summary>
        <input
          inputMode="decimal"
          placeholder="seconds"
          defaultValue={value ?? ""}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) && e.target.value !== "" ? n : null);
          }}
          className="tnum mt-3 h-12 w-full rounded-xl bg-ink px-4 text-center text-lg ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
        />
      </details>
    </div>
  );
}

/* ---------------------------------------------------------------- stepper */

function StepperInput({
  test,
  value,
  onChange,
}: {
  test: BatteryTest;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const current = value ?? 0;
  const set = (n: number) => onChange(Math.max(test.min, Math.min(test.max, n)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-4">
        <Button
          size="icon"
          variant="secondary"
          className="h-16 w-16 rounded-2xl"
          onClick={() => set(current - 1)}
          aria-label="One fewer"
        >
          <Minus size={26} />
        </Button>
        <div className="flex h-32 w-36 items-center justify-center rounded-3xl bg-ink ring-1 ring-ink-line">
          <span className="score-hero tnum text-[64px]">{current}</span>
        </div>
        <Button
          size="icon"
          variant="primary"
          className="h-16 w-16 rounded-2xl"
          onClick={() => set(current + 1)}
          aria-label="One more"
        >
          <Plus size={26} />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[5, 10, 20, 30].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => set(n)}
            className="h-11 rounded-xl bg-ink-raised text-sm font-semibold text-paper-dim ring-1 ring-ink-line hover:text-paper"
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-paper-faint">
        Tap a number to jump there, then adjust.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- half step */

function HalfStepInput({
  onChange,
}: {
  onChange: (value: number | null) => void;
}) {
  // The sit-rising test is scored as two halves. Scoring them separately is
  // how the protocol actually works and it removes most of the arithmetic
  // errors people make adding them up in their head.
  const [sitting, setSitting] = React.useState(5);
  const [rising, setRising] = React.useState(5);

  React.useEffect(() => {
    onChange(Math.round((sitting + rising) * 2) / 2);
  }, [sitting, rising, onChange]);

  return (
    <div className="space-y-5">
      <div className="flex h-28 items-center justify-center rounded-3xl bg-ink ring-1 ring-ink-line">
        <span className="score-hero tnum text-[56px]">{(sitting + rising).toFixed(1)}</span>
        <span className="ml-2 self-end pb-3 text-base text-paper-faint">/ 10</span>
      </div>

      {(
        [
          ["Sitting down", sitting, setSitting],
          ["Standing up", rising, setRising],
        ] as const
      ).map(([label, val, set]) => (
        <div key={label}>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-medium text-paper-dim">{label}</span>
            <span className="tnum text-lg font-bold">{val.toFixed(1)}</span>
          </div>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, i) => i * 0.5).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set(n)}
                className={cn(
                  "h-11 rounded-lg text-[11px] font-semibold ring-1 transition-colors",
                  val === n
                    ? "bg-signal text-ink ring-signal"
                    : "bg-ink text-paper-faint ring-ink-line hover:text-paper-dim",
                )}
              >
                {n % 1 === 0 ? n : `${Math.floor(n)}½`}
              </button>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs leading-relaxed text-paper-faint">
        Start at 5 each way. Take a point off for every hand, knee, forearm or
        side of leg you lean on. Half a point for a wobble.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- number pad */

function NumberPadInput({
  test,
  value,
  onChange,
}: {
  test: BatteryTest;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [text, setText] = React.useState(value === null ? "" : String(value));

  React.useEffect(() => {
    const n = Number(text);
    onChange(text !== "" && Number.isFinite(n) ? n : null);
  }, [text, onChange]);

  const press = (key: string) => {
    setText((prev) => {
      if (key === "del") return prev.slice(0, -1);
      if (key === ".") return prev.includes(".") ? prev : prev === "" ? "0." : prev + ".";
      const next = prev + key;
      return Number(next) > test.max ? prev : next;
    });
  };

  const numeric = Number(text);
  const outOfRange = text !== "" && (numeric < test.min || numeric > test.max);

  return (
    <div className="space-y-4">
      <div className="flex h-28 items-baseline justify-center gap-2 rounded-3xl bg-ink ring-1 ring-ink-line">
        <span className="score-hero tnum self-center text-[60px]">
          {text === "" ? <span className="text-paper-faint">0</span> : text}
        </span>
        <span className="self-center pt-6 text-lg text-paper-faint">{test.unit}</span>
      </div>

      {outOfRange && (
        <p className="text-center text-xs font-medium text-below">
          Outside the plausible range for this test ({test.min}-{test.max} {test.unit}).
          Check it before you save.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", test.step < 1 ? "." : "", "0", "del"].map(
          (key, i) =>
            key === "" ? (
              <div key={`spacer-${i}`} />
            ) : (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                className="h-14 rounded-xl bg-ink-raised text-2xl font-semibold ring-1 ring-ink-line active:bg-ink-line"
              >
                {key === "del" ? "⌫" : key}
              </button>
            ),
        )}
      </div>
    </div>
  );
}
