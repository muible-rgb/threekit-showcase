import { createScorer, type BenchmarkScorer } from "./benchmark";
import { ageAt } from "./cohort";
import type { BenchmarkLookup, FitnessAge, Sex, TestBinding, TestPercentile } from "./types";

interface AgeCurvePoint {
  age: number;
  median: number;
}

/** Population median of one event at every age the table covers, ascending. */
function medianCurve(scorer: BenchmarkScorer, event: string, sex: Sex, ageMin: number, ageMax: number): AgeCurvePoint[] {
  const out: AgeCurvePoint[] = [];
  for (let age = ageMin; age <= ageMax; age++) {
    const median = scorer.medianAt(event, sex, age);
    if (median !== null) out.push({ age, median });
  }
  return out;
}

/**
 * Fitness age for one test: the age at which this raw result would be exactly
 * average for this person's sex.
 *
 * Two wrinkles the naive version gets wrong.
 *
 * First, the median-vs-age curve is NOT monotone across the whole range. Grip
 * strength peaks around 30, so the same carry distance is "average" at both 22
 * and 38. We take the declining tail from the peak onwards, which is the
 * meaningful reading: you are as strong as the average N-year-old, where N is
 * on the downslope. It also stops the pre-peak rise from handing someone an
 * absurdly young fitness age.
 *
 * Second, a result better than the peak median, or worse than the oldest
 * age's, has no crossing at all. It clamps to the end of the curve and is
 * flagged out of range. A 40-year-old who out-jumps the average 25-year-old
 * gets "25 or younger" - resolving it further would be making numbers up.
 *
 * Discrete events (reps, sit-to-rise) have medians that step, so the curve has
 * plateaus. A result landing on a plateau reads the younger end of it.
 */
export function fitnessAgeForTest(
  scorer: BenchmarkScorer,
  binding: TestBinding,
  rawInAppUnits: number,
  sex: Sex,
  ageMin: number,
  ageMax: number,
): { years: number; outOfRange: boolean } | null {
  const ev = scorer.event(binding.event);
  if (!ev) return null;
  const curve = medianCurve(scorer, binding.event, sex, ageMin, ageMax);
  if (curve.length < 2) return null;

  const value = rawInAppUnits * binding.factor;
  // Put everything on a "bigger is better" scale so one comparison works for
  // both directions.
  const g = (v: number) => (ev.lower_better ? -v : v);
  const target = g(value);

  // Trim to the declining tail, starting at the best age.
  let peak = 0;
  for (let i = 1; i < curve.length; i++) {
    if (g(curve[i].median) > g(curve[peak].median)) peak = i;
  }
  const tail = curve.slice(peak);

  const best = tail[0];
  const worst = tail[tail.length - 1];

  if (target >= g(best.median)) {
    return { years: best.age, outOfRange: target > g(best.median) };
  }
  if (target < g(worst.median)) {
    return { years: worst.age, outOfRange: true };
  }

  for (let i = 0; i < tail.length - 1; i++) {
    const younger = tail[i];
    const older = tail[i + 1];
    const gy = g(younger.median);
    const go = g(older.median);
    if (target <= gy && target >= go) {
      if (gy === go) return { years: younger.age, outOfRange: false };
      const t = (gy - target) / (gy - go);
      const years = younger.age + t * (older.age - younger.age);
      return { years: Math.round(years * 10) / 10, outOfRange: false };
    }
  }

  /* c8 ignore next */
  return { years: worst.age, outOfRange: true };
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface FitnessAgeInput {
  sex: Sex;
  birthDate: string;
  completedAt: string;
  tests: TestPercentile[];
  bindings: TestBinding[];
  lookup: BenchmarkLookup;
}

/**
 * Composite fitness age: the median of the per-test fitness ages.
 *
 * Median rather than mean, because one clamped test at the end of the curve
 * would otherwise drag the whole number. Flagged "approx" when more than three
 * tests clamped, which is the signal that the table simply does not reach this
 * person and the number should be read loosely.
 */
export function computeFitnessAge(input: FitnessAgeInput): FitnessAge | null {
  const scorer = createScorer(input.lookup);
  const perTest: FitnessAge["perTest"] = [];

  for (const t of input.tests) {
    const binding = input.bindings.find((b) => b.slug === t.testVariant);
    if (!binding) continue;
    const r = fitnessAgeForTest(
      scorer,
      binding,
      t.raw,
      input.sex,
      input.lookup.age_min,
      input.lookup.age_max,
    );
    if (!r) continue;
    perTest.push({ testVariant: t.testVariant, years: r.years, outOfRange: r.outOfRange });
  }

  if (perTest.length === 0) return null;

  const outOfRangeCount = perTest.filter((p) => p.outOfRange).length;
  const years = Math.round(median(perTest.map((p) => p.years)) * 10) / 10;

  return { years, approx: outOfRangeCount > 3, outOfRangeCount, perTest };
}

/** Chronological age at the time the battery was completed. */
export function chronologicalAge(birthDate: string, completedAt: string): number {
  return ageAt(birthDate, completedAt);
}
