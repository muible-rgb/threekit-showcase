import type {
  BenchmarkEvent,
  BenchmarkLookup,
  ContinuousBenchmarkEvent,
  Derivation,
  DiscreteBenchmarkEvent,
  EvidenceGrade,
  Sex,
  TestBinding,
} from "../types";

/**
 * Synthetic benchmark tables for engine tests.
 *
 * The real table is 580 kB of numbers nobody can reason about in a test. These
 * builders produce tiny tables with shapes chosen so the expected answers can
 * be worked out by hand: quantiles that are linear in the percentile, medians
 * that fall one unit a year.
 */

export const PCTS = Array.from({ length: 99 }, (_, i) => i + 1);
export const AGE_MIN = 18;
export const AGE_MAX = 89;
const SEXES: Sex[] = ["M", "F"];

function byAge<T>(f: (age: number) => T): Record<string, T> {
  const out: Record<string, T> = {};
  for (let a = AGE_MIN; a <= AGE_MAX; a++) out[String(a)] = f(a);
  return out;
}

export interface ContinuousOpts {
  /** Population median at an age. */
  median: (age: number) => number;
  /** Half the P1-P99 span. Quantile at p = median + ((p - 50) / 50) * spread. */
  spread: number;
  lower_better?: boolean;
  floor?: number | null;
  ceiling?: number | null;
  grade?: EvidenceGrade;
  derivation?: Derivation;
  unit?: string;
}

/** Quantiles linear in the percentile, so raw = median lands on exactly 50. */
export function continuousEvent(opts: ContinuousOpts): ContinuousBenchmarkEvent {
  const lower = opts.lower_better ?? false;
  const grade = opts.grade ?? "B";
  const derivation = opts.derivation ?? "observed";
  const qAt = (age: number) =>
    PCTS.map((p) => {
      const offset = ((p - 50) / 50) * opts.spread;
      let v = lower ? opts.median(age) - offset : opts.median(age) + offset;
      if (opts.ceiling != null && !lower) v = Math.min(v, opts.ceiling);
      if (opts.floor != null) v = lower ? Math.min(v, opts.floor) : Math.max(v, opts.floor);
      return v;
    });
  return {
    unit: opts.unit ?? "u",
    lower_better: lower,
    discrete: false,
    grade: { M: grade, F: grade },
    floor: opts.floor ?? null,
    ceiling: opts.ceiling ?? null,
    derivation: { M: byAge(() => derivation), F: byAge(() => derivation) },
    q: { M: byAge(qAt), F: byAge(qAt) },
  };
}

export interface DiscreteOpts {
  grid: number[];
  /** P(X <= grid[i]) at an age. Must be non-decreasing and end at 1. */
  cdf: (age: number) => number[];
  ceiling?: number | null;
  grade?: EvidenceGrade;
  unit?: string;
}

export function discreteEvent(opts: DiscreteOpts): DiscreteBenchmarkEvent {
  const grade = opts.grade ?? "B";
  return {
    unit: opts.unit ?? "reps",
    lower_better: false,
    discrete: true,
    grade: { M: grade, F: grade },
    floor: null,
    ceiling: opts.ceiling ?? null,
    derivation: { M: byAge(() => "observed"), F: byAge(() => "observed") },
    grid: opts.grid,
    cdf: { M: byAge(opts.cdf), F: byAge(opts.cdf) },
  };
}

export function lookupOf(events: Record<string, BenchmarkEvent>, version = "test"): BenchmarkLookup {
  return {
    version,
    generated: "2026-01-01",
    percentiles: PCTS,
    age_min: AGE_MIN,
    age_max: AGE_MAX,
    convention: "midrank",
    events,
  };
}

/** A binding with no unit conversion: the app stores what the table speaks. */
export function bindingOf(slug: string, event = slug, factor = 1): TestBinding {
  return { slug, capacity: `cap_${slug}`, unit: "u", event, factor };
}

/**
 * A complete eight-test battery. Every event has median 100 at 18 falling one
 * unit a year, spread 20, so at age 42 the median is 76 and a raw of 86 is P75.
 * The last event is Grade D, so exactly one test reads as provisional.
 */
export function eightTestFixture(): { lookup: BenchmarkLookup; bindings: TestBinding[] } {
  const events: Record<string, BenchmarkEvent> = {};
  const bindings: TestBinding[] = [];
  for (let i = 0; i < 8; i++) {
    events[`e${i}`] = continuousEvent({
      median: (age) => 100 - (age - AGE_MIN),
      spread: 20,
      grade: i === 7 ? "D" : "B",
    });
    bindings.push(bindingOf(`t${i}`, `e${i}`));
  }
  return { lookup: lookupOf(events), bindings };
}

export { SEXES };
