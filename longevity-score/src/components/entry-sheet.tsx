"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn, formatRaw, secondsToClock } from "@/lib/utils";
import { CARRY_LOAD_LB, CARRY_LOAD_TOLERANCE, carryLoadDrift } from "@/lib/battery";
import type { BatteryTest } from "@/lib/battery";
import type { Sex } from "@/lib/scoring/types";

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
  currentSecondary,
  sex,
  onSave,
  onClose,
}: {
  test: BatteryTest;
  current: number | null;
  currentSecondary: number | null;
  sex: Sex;
  onSave: (value: number, secondary: number | null) => void | Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = React.useState<number | null>(current);
  const [secondary, setSecondary] = React.useState<number | null>(
    // Default to the prescribed load, so the common case is already filled in
    // and the uncommon case is a deliberate edit.
    currentSecondary ?? (test.secondary ? CARRY_LOAD_LB[sex] : null),
  );
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

  const secondaryValid =
    !test.secondary ||
    (secondary !== null &&
      secondary >= test.secondary.min &&
      secondary <= test.secondary.max);
  const valid =
    value !== null && value >= test.min && value <= test.max && secondaryValid;

  const drift = test.secondary ? carryLoadDrift(secondary, sex) : null;
  const offProtocol = drift !== null && Math.abs(drift) > CARRY_LOAD_TOLERANCE;

  // Could not finish. Recorded as the floor value and scored with everyone
  // else who could not - a result in the low tail, not missing data.
  const canDnf = test.dnfValue !== undefined;
  const isDnf = canDnf && value === test.dnfValue;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-board/85">
      {/* Tap-outside-to-dismiss. Not a button: the header already has a real
          Close control, and two things announced as "Close" is worse than one. */}
      <div className="flex-1" role="presentation" onClick={onClose} />

      <div
        role="dialog"
        aria-label={test.name}
        className="pb-safe max-h-[92dvh] overflow-y-auto border-t border-rule-2 bg-board"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-rule bg-board px-pad pb-3 pt-5">
          <div className="min-w-0">
            <h2 className="name text-[22px]">{test.name}</h2>
            <p className="meta mt-1">{test.standard}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="label shrink-0 px-1 py-1 text-chalk-dim hover:text-chalk"
          >
            Close
          </button>
        </div>

        <div className="px-pad pb-5 pt-4">
          {test.secondary && (
            <SecondaryInput
              test={test}
              value={secondary}
              sex={sex}
              onChange={setSecondary}
            />
          )}

          {isDnf ? (
            <div className="flex h-24 items-center justify-center border border-rule-2">
              <span className="figure text-[48px]">DNF</span>
            </div>
          ) : (
            <ValueInput test={test} value={value} onChange={setValue} />
          )}

          {canDnf && (
            <button
              type="button"
              onClick={() => setValue(isDnf ? null : test.dnfValue!)}
              className="label mt-3 text-chalk"
            >
              {isDnf ? "Enter a time instead" : "Did not finish"}
            </button>
          )}

          {offProtocol && (
            <p className="mt-3 border border-rule-2 p-3 text-[12px] leading-relaxed text-chalk-dim">
              That is {Math.abs(Math.round(drift! * 100))}%{" "}
              {drift! > 0 ? "heavier" : "lighter"} than the prescribed{" "}
              {CARRY_LOAD_LB[sex]} lb. The norms assume {CARRY_LOAD_LB[sex]}, so
              your percentile will be marked off-protocol rather than compared
              as if it matched.
            </p>
          )}

          <details className="mt-5">
            <summary className="label cursor-pointer">Full protocol</summary>
            <p className="mt-2 text-[13px] leading-relaxed text-chalk-dim">
              {test.protocol}
            </p>
          </details>
        </div>

        <div className="sticky bottom-0 space-y-2 border-t border-rule-2 bg-board px-pad py-4">
          <Button
            size="lg"
            variant="accent"
            className="w-full"
            disabled={!valid || saving}
            onClick={async () => {
              if (!valid) return;
              setSaving(true);
              await onSave(value!, secondary);
            }}
          >
            {saving ? "Saving..." : current === null ? "Save" : "Update"}
          </Button>
          {current !== null && (
            <p className="meta">
              Now {formatRaw(current, test.unit)}. The old entry is kept.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The second number, where the scored one needs context. Today that is the
 * carry: distance without load is not a result.
 */
function SecondaryInput({
  test,
  value,
  sex,
  onChange,
}: {
  test: BatteryTest;
  value: number | null;
  sex: Sex;
  onChange: (v: number | null) => void;
}) {
  const spec = test.secondary!;
  const [text, setText] = React.useState(value === null ? "" : String(value));

  React.useEffect(() => {
    const n = Number(text);
    onChange(text !== "" && Number.isFinite(n) ? n : null);
  }, [text, onChange]);

  const suggested = CARRY_LOAD_LB[sex];

  return (
    <div className="mb-5">
      <label className="block">
        <span className="label">{spec.label}</span>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder={String(suggested)}
            aria-label={spec.label}
            className="num h-14 w-full min-w-0 flex-1 border border-rule-2 bg-board px-3 text-[24px] text-chalk focus:border-chalk focus:outline-none"
          />
          <span className="label w-7 shrink-0">{spec.unitLabel}</span>
        </div>
      </label>
      {Number(text) !== suggested && (
        <button
          type="button"
          onClick={() => setText(String(suggested))}
          className="label mt-2 text-chalk"
        >
          Use {suggested} lb
        </button>
      )}
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
  if (test.input === "feet_inches")
    return <FeetInchesInput test={test} value={value} onChange={onChange} />;
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
      <div className="flex items-center justify-center gap-2 border border-rule-2 py-6">
        <input
          inputMode="numeric"
          autoFocus
          value={min}
          onChange={(e) => setMin(e.target.value.replace(/\D/g, "").slice(0, 2))}
          placeholder="0"
          aria-label="Minutes"
          className="figure w-24 bg-transparent text-right text-[56px] text-chalk outline-none placeholder:text-chalk-off"
        />
        <span className="figure text-[48px] text-chalk-off">:</span>
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
          className="figure w-24 bg-transparent text-left text-[56px] text-chalk outline-none placeholder:text-chalk-off"
        />
      </div>
      <p className="label mt-2">Minutes : seconds</p>
    </div>
  );
}

/**
 * Broad jump. Two fields, because a jump is said in feet and inches - "3 foot
 * 9" - and a plain decimal keypad quietly turns that into 3.9 inches instead
 * of 45. Mirrors TimeInput's split-field shape for the same reason the mile
 * gets one: the natural unit is compound, so the keypad should be too.
 */
function FeetInchesInput({
  test,
  value,
  onChange,
}: {
  test: BatteryTest;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const initialFeet = value === null ? 0 : Math.floor(value / 12);
  const initialInches = value === null ? 0 : Math.round(value - initialFeet * 12);
  const [feet, setFeet] = React.useState(value === null ? "" : String(initialFeet));
  const [inches, setInches] = React.useState(value === null ? "" : String(initialInches));

  React.useEffect(() => {
    const f = Number(feet);
    const i = Number(inches === "" ? "0" : inches);
    if (feet === "" || !Number.isFinite(f) || !Number.isFinite(i)) {
      onChange(null);
      return;
    }
    onChange(f * 12 + i);
  }, [feet, inches, onChange]);

  const total = Number(feet || 0) * 12 + Number(inches || 0);
  const low = feet !== "" && total < test.min;
  const minFeet = Math.floor(test.min / 12);
  const maxFeet = Math.floor(test.max / 12);

  return (
    <div>
      <div className="flex items-center justify-center gap-2 border border-rule-2 py-6">
        <input
          inputMode="numeric"
          autoFocus
          value={feet}
          onChange={(e) => setFeet(e.target.value.replace(/\D/g, "").slice(0, 2))}
          placeholder="0"
          aria-label="Feet"
          className="figure w-20 bg-transparent text-right text-[56px] text-chalk outline-none placeholder:text-chalk-off"
        />
        <span className="figure text-[40px] text-chalk-off">&apos;</span>
        <input
          inputMode="numeric"
          value={inches}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
            setInches(Number(raw) > 11 ? "11" : raw);
          }}
          onBlur={() => setInches((s) => (s === "" ? "0" : s))}
          placeholder="0"
          aria-label="Inches"
          className="figure w-16 bg-transparent text-left text-[56px] text-chalk outline-none placeholder:text-chalk-off"
        />
        <span className="figure text-[40px] text-chalk-off">&quot;</span>
      </div>
      <p className="label mt-2">Feet : inches</p>
      {low && (
        <p className="meta mt-1">
          Below the plausible range ({minFeet}&apos;-{maxFeet}&apos;).
        </p>
      )}
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
          className="num h-16 w-16 border border-rule-2 text-[28px] text-chalk active:bg-board-2"
        >
          −
        </button>
        <div className="flex h-28 w-32 items-center justify-center border border-rule-2">
          <span className="figure text-[56px]">{current}</span>
        </div>
        <button
          onClick={() => set(current + 1)}
          aria-label="One more"
          className="num h-16 w-16 border border-chalk text-[28px] text-chalk active:bg-board-2"
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
              "num h-11 border text-[13px]",
              current === n
                ? "border-chalk text-chalk"
                : "border-rule-2 text-chalk-dim",
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
      <div className="flex h-24 items-center justify-center gap-2 border border-rule-2">
        <span className="figure text-[52px]">
          {text === "" ? <span className="text-chalk-off">0</span> : text}
        </span>
        <span className="label self-end pb-5">{test.unitLabel}</span>
      </div>

      {low && (
        <p className="meta">Below the plausible range ({test.min}-{test.max}).</p>
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
                className="num h-14 border border-rule-2 text-[22px] text-chalk active:bg-board-2"
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
      <div className="flex h-24 items-center justify-center border border-rule-2">
        <span className="figure text-[48px]">{(sitting + rising).toFixed(1)}</span>
        <span className="label ml-2 self-end pb-4">/ 10</span>
      </div>

      {(
        [
          ["Sitting down", sitting, setSitting],
          ["Standing up", rising, setRising],
        ] as const
      ).map(([label, val, set]) => (
        <div key={label}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="label">{label}</span>
            <span className="num text-name">{val.toFixed(1)}</span>
          </div>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, i) => i * 0.5).map((n) => (
              <button
                key={n}
                onClick={() => set(n)}
                className={cn(
                  "num h-10 border text-[10px]",
                  val === n
                    ? "border-chalk text-chalk"
                    : "border-rule-2 text-chalk-off",
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
