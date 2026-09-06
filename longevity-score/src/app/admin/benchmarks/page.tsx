import type { Metadata } from "next";
import { BATTERY_TESTS } from "@/lib/battery";
import { BENCHMARKS, CURRENT_BENCHMARK_VERSION, scorer } from "@/lib/benchmarks/registry";
import { coverageLine, eventGrades } from "@/lib/benchmarks/summary";
import type { Sex } from "@/lib/scoring/types";

export const metadata: Metadata = {
  title: "Benchmarks",
  robots: { index: false, follow: false },
};

/**
 * The validation table from the handoff, run live against the shipped table.
 * If a row goes red here, either the JSON changed without a version bump or the
 * scorer drifted from the reference implementation.
 */
const VALIDATION: Array<[string, Sex, number, number, number]> = [
  ["mile_run", "M", 39, 402, 89.6],
  ["push_ups", "M", 39, 37, 91.3],
  ["mile_run", "F", 42, 480, 97.9],
  ["push_ups", "F", 42, 7, 64.8],
  ["pull_ups", "M", 25, 0, 16.6],
  ["pull_ups", "M", 25, 1, 33.8],
  ["pull_ups", "F", 70, 0, 48.8],
  ["pull_ups", "F", 70, 1, 98.1],
  ["single_leg_balance_ec", "M", 25, 60, 93.4],
  ["sit_to_rise", "M", 25, 10, 76.9],
  ["broad_jump", "F", 85, 0, 19.2],
  ["pro_agility_5_10_5", "M", 85, 30, 15.2],
  ["farmer_carry", "M", 40, 159, 49.9],
  ["mile_run", "M", 85, 1800, 5.1],
];

/**
 * Which benchmark tables are loaded and what each event in the current one
 * looks like. Deliberately the only admin surface. Nothing here is sensitive -
 * it is the same data /methodology publishes, arranged for someone deciding
 * what to recalibrate next. Noindex rather than authenticated for that reason.
 */
export default function AdminBenchmarksPage() {
  const table = BENCHMARKS[CURRENT_BENCHMARK_VERSION];
  const checks = VALIDATION.map(([event, sex, age, raw, expected]) => {
    const got = scorer.scoreEvent(event, sex, age, raw).score;
    return { event, sex, age, raw, expected, got, ok: got === expected };
  });
  const failing = checks.filter((c) => !c.ok).length;

  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="name text-[26px]">Benchmarks</h1>
        <p className="meta mt-2">
          Current v{table.version} · generated {table.generated} · {table.convention} ·{" "}
          {Object.keys(BENCHMARKS).length} version{Object.keys(BENCHMARKS).length === 1 ? "" : "s"} loaded
        </p>
      </header>

      <section>
        <h2 className="label border-b border-rule-2 pb-2">Validation</h2>
        <p className="meta mt-2">
          {failing === 0
            ? `All ${checks.length} reference values match.`
            : `${failing} of ${checks.length} reference values do not match.`}
        </p>
        <div className="mt-2">
          {checks.map((c) => (
            <div
              key={`${c.event}-${c.sex}-${c.age}-${c.raw}`}
              className="grid grid-cols-[1fr_auto_auto] items-baseline gap-gap border-b border-rule py-2"
            >
              <span className="meta truncate">
                {c.event} · {c.sex} {c.age} · {c.raw}
              </span>
              <span className="num text-label">{c.got.toFixed(1)}</span>
              <span className={`label w-10 text-right ${c.ok ? "text-chalk-dim" : "text-chalk"}`}>
                {c.ok ? "ok" : `≠${c.expected}`}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label border-b border-rule-2 pb-2">Events</h2>
        {BATTERY_TESTS.map((test) => {
          const ev = table.events[test.benchmark.event];
          return (
            <div key={test.slug} className="border-b border-rule py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="name text-name">{test.name}</span>
                <span className="label">grade {eventGrades(ev)}</span>
              </div>
              <p className="meta mt-1">
                {test.benchmark.event} · {ev.unit}
                {test.benchmark.factor !== 1 && ` (app stores ${test.unit} × ${test.benchmark.factor})`}
                {" · "}
                {ev.discrete ? `discrete, ${ev.grid.length} grid points` : "continuous, 99 anchors"}
                {ev.floor !== null && ` · floor ${ev.floor}`}
                {ev.ceiling !== null && ` · ceiling ${ev.ceiling}`}
              </p>
              <p className="meta mt-0.5">{coverageLine(ev)}</p>
            </div>
          );
        })}
      </section>

      <p className="meta">
        Tables are immutable once shipped. A recalibration is a new file under
        data/benchmarks and a new key in the registry, never an edit. Regenerate
        with tools/benchmarks/build.py.
      </p>
    </div>
  );
}
