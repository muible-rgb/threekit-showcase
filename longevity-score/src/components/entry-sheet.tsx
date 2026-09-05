"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatRaw, secondsToClock } from "@/lib/utils";
import type { BatteryTest } from "@/lib/battery";

/**
 * Tap a test, type the number, save. That is the whole interaction.
 *
 * No stopwatch, no rest timer, no wizard: you did the test outside, in the
 * world, and you are entering what you got. The only thing this screen owes
 * you is a keypad big enough to hit while you are still breathing hard, and
 * the standard written down so two people score it the same way.
 */
export function EntrySheet({
  test,
  current,
  bodyweightLb,
  onSave,
  onClose,
}: {
  test: BatteryTest;
  current: number | null;
  bodyweightLb: number | null;
  onSave: (value: number) => void | Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = React.useState<number | null>(current);
  const [saving, setSaving] = React.useState(false);

  // Escape closes, and the sheet takes focus so a hardware keyboard works.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const valid = value !== null && value >= test.min && value <= test.max;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/70 backdrop-blur-sm">
      {/* Tap-outside-to-dismiss. Not a button: the header already has a real
          Close control, and two things announced as "Close" is worse than one. */}
      <div className="flex-1" role="presentation" onClick={onClose} />

      <div
        role="dialog"
        aria-label={test.name}
        className="pb-safe max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-ink-raised ring-1 ring-ink-line"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-ink-raised px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight">{test.name}</h2>
            <p className="mt-0.5 text-sm text-signal">{test.standard}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-paper-faint hover:bg-ink-line"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-5">
          {test.slug === "farmer_carry" && bodyweightLb !== null && (
            <p className="mb-4 rounded-xl bg-signal/10 px-4 py-3 text-sm font-semibold text-signal ring-1 ring-signal/25">
              {Math.round(bodyweightLb / 2)} lb in each hand
            </p>
          )}

          <ValueInput test={test} value={value} onChange={setValue} />

          <details className="mt-5">
            <summary className="cursor-pointer text-xs font-semibold text-paper-faint">
              Full protocol
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-paper-dim">
              {test.protocol}
            </p>
          </details>
        </div>

        <div className="sticky bottom-0 space-y-2 border-t border-ink-line-soft bg-ink-raised px-5 py-4">
          <Button
            size="lg"
            className="w-full"
            disabled={!valid || saving}
            onClick={async () => {
              if (!valid) return;
              setSaving(true);
              await onSave(value!);
            }}
          >
            {saving ? "Saving..." : current === null ? "Save" : "Update"}
          </Button>
          {current !== null && (
            <p className="text-center text-xs text-paper-faint">
              Currently {formatRaw(current, test.unit)}. Saving keeps the old
              entry in your history.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ input */

function ValueInput({
  test,
  value,
  onChange,
}: {
  test: BatteryTest;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  if (test.input === "time") return <TimeInput value={value} onChange={onChange} />;
  if (test.input === "half_step") return <HalfStepInput value={value} onChange={onChange} />;
  if (test.input === "reps") return <RepsInput test={test} value={value} onChange={onChange} />;
  return <NumberInput test={test} value={value} onChange={onChange} />;
}

/** Mile. Two fields, because nobody thinks of a mile as 462 seconds. */
function TimeInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const initial = value === null ? { minutes: 0, seconds: 0 } : secondsToClock(value);
  const [min, setMin] = React.useState(value === null ? "" : String(initial.minutes));
  const [sec, setSec] = React.useState(
    value === null ? "" : String(initial.seconds).padStart(2, "0"),
  );

  React.useEffect(() => {
    const m = Number(min);
    const s = Number(sec);
    if (min === "" || !Number.isFinite(m) || !Number.isFinite(s)) {
      onChange(null);
      return;
    }
    onChange(m * 60 + s);
  }, [min, sec, onChange]);

  return (
    <div>
      <div className="flex items-center justify-center gap-2 rounded-3xl bg-ink py-7 ring-1 ring-ink-line">
        <input
          inputMode="numeric"
          autoFocus
          value={min}
          onChange={(e) => setMin(e.target.value.replace(/\D/g, "").slice(0, 2))}
          placeholder="0"
          aria-label="Minutes"
          className="score-hero tnum w-24 bg-transparent text-right text-[60px] outline-none placeholder:text-paper-faint"
        />
        <span className="score-hero text-[52px] text-paper-faint">:</span>
        <input
          inputMode="numeric"
          value={sec}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
            setSec(Number(raw) > 59 ? "59" : raw);
          }}
          onBlur={() => setSec((s) => (s === "" ? "00" : s.padStart(2, "0")))}
          placeholder="00"
          aria-label="Seconds"
          className="score-hero tnum w-24 bg-transparent text-left text-[60px] outline-none placeholder:text-paper-faint"
        />
      </div>
      <p className="mt-2 text-center text-xs text-paper-faint">minutes : seconds</p>
    </div>
  );
}

function RepsInput({
  test,
  value,
  onChange,
}: {
  test: BatteryTest;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const current = value ?? 0;
  const set = (n: number) => onChange(Math.max(test.min, Math.min(test.max, n)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => set(current - 1)}
          aria-label="One fewer"
          className="h-16 w-16 rounded-2xl bg-ink text-3xl font-semibold ring-1 ring-ink-line active:bg-ink-line"
        >
          −
        </button>
        <div className="flex h-28 w-32 items-center justify-center rounded-3xl bg-ink ring-1 ring-ink-line">
          <span className="score-hero tnum text-[60px]">{current}</span>
        </div>
        <button
          onClick={() => set(current + 1)}
          aria-label="One more"
          className="h-16 w-16 rounded-2xl bg-signal text-3xl font-semibold text-ink active:bg-signal-dim"
        >
          +
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[0, 5, 10, 20, 30].map((n) => (
          <button
            key={n}
            onClick={() => set(n)}
            className={cn(
              "h-11 rounded-xl text-sm font-semibold ring-1 transition-colors",
              current === n
                ? "bg-signal text-ink ring-signal"
                : "bg-ink text-paper-dim ring-ink-line",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberInput({
  test,
  value,
  onChange,
}: {
  test: BatteryTest;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [text, setText] = React.useState(value === null ? "" : String(value));
  const decimals = test.step < 1;

  React.useEffect(() => {
    const n = Number(text);
    onChange(text !== "" && Number.isFinite(n) ? n : null);
  }, [text, onChange]);

  const press = (key: string) => {
    setText((prev) => {
      if (key === "del") return prev.slice(0, -1);
      if (key === ".") return prev.includes(".") ? prev : prev === "" ? "0." : `${prev}.`;
      const next = prev + key;
      return Number(next) > test.max ? prev : next;
    });
  };

  const n = Number(text);
  const low = text !== "" && n < test.min;

  return (
    <div className="space-y-3">
      <div className="flex h-24 items-center justify-center gap-2 rounded-3xl bg-ink ring-1 ring-ink-line">
        <span className="score-hero tnum text-[56px]">
          {text === "" ? <span className="text-paper-faint">0</span> : text}
        </span>
        <span className="self-end pb-5 text-base text-paper-faint">
          {test.unitLabel}
        </span>
      </div>

      {low && (
        <p className="text-center text-xs text-below">
          Below the plausible range ({test.min}-{test.max}). Check it.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", decimals ? "." : "", "0", "del"].map(
          (key, i) =>
            key === "" ? (
              <div key={`gap-${i}`} />
            ) : (
              <button
                key={key}
                onClick={() => press(key)}
                className="h-14 rounded-xl bg-ink text-2xl font-semibold ring-1 ring-ink-line active:bg-ink-line"
              >
                {key === "del" ? "⌫" : key}
              </button>
            ),
        )}
      </div>
    </div>
  );
}

/** Sit-to-rise, scored the way the protocol actually works: two halves. */
function HalfStepInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [sitting, setSitting] = React.useState(value === null ? 5 : Math.min(5, value / 2));
  const [rising, setRising] = React.useState(value === null ? 5 : Math.max(0, value - Math.min(5, value / 2)));

  React.useEffect(() => {
    onChange(Math.round((sitting + rising) * 2) / 2);
  }, [sitting, rising, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex h-24 items-center justify-center rounded-3xl bg-ink ring-1 ring-ink-line">
        <span className="score-hero tnum text-[52px]">
          {(sitting + rising).toFixed(1)}
        </span>
        <span className="ml-2 self-end pb-4 text-base text-paper-faint">/ 10</span>
      </div>

      {(
        [
          ["Sitting down", sitting, setSitting],
          ["Standing up", rising, setRising],
        ] as const
      ).map(([label, val, set]) => (
        <div key={label}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm text-paper-dim">{label}</span>
            <span className="tnum text-base font-bold">{val.toFixed(1)}</span>
          </div>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, i) => i * 0.5).map((n) => (
              <button
                key={n}
                onClick={() => set(n)}
                className={cn(
                  "h-10 rounded-lg text-[10px] font-semibold ring-1 transition-colors",
                  val === n
                    ? "bg-signal text-ink ring-signal"
                    : "bg-ink text-paper-faint ring-ink-line",
                )}
              >
                {n % 1 === 0 ? n : "½"}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
