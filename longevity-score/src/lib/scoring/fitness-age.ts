import { ageAt } from "./cohort";
import type {
  Direction,
  FitnessAge,
  NormCohort,
  NormsFile,
  NormsRegistry,
  Sex,
  TestPercentile,
} from "./types";

/**
 * The 50th-percentile value for a cohort, whichever norms format it uses.
 * For mean/SD that is the mean. For cut-points it is the published "50".
 */
function medianValue(cohort: NormCohort): number | null {
  if (cohort.mean !== undefined) return cohort.mean;
  const p50 = cohort.percentiles?.["50"];
  return p50 === undefined ? null : p50;
}

interface AgeCurvePoint {
  age: number; // band midpoint
  median: number;
}

function ageCurve(norms: NormsFile, sex: Sex): AgeCurvePoint[] {
  return norms.cohorts
    .filter((c) => c.sex === sex)
    .map((c) => ({
      age: (c.age_min + c.age_max) / 2,
      median: medianValue(c),
    }))
    .filter((p): p is AgeCurvePoint => p.median !== null)
    .sort((a, b) => a.age - b.age);
}

/**
 * Fitness age for one test: the age at which this raw result would be exactly
 * average for this person's sex.
 *
 * Two wrinkles the naive version gets wrong.
 *
 * First, the median-vs-age curve is NOT monotone across the whole range. Grip
 * strength peaks in the late twenties, so a 52.5 kg grip is "average" at both
 * 22 and 32. We take the declining tail from the peak onwards, which is the
 * meaningful reading: you are as strong as the average N-year-old, where N is
 * on the downslope. It also stops the pre-peak rise from handing someone an
 * absurdly young fitness age.
 *
 * Second, a result better than the peak band's median, or worse than the
 * oldest band's, has no crossing at all. It clamps to the end of the curve and
 * is flagged out of range. A 40-year-old who out-jumps the average 27-year-old
 * gets "27 or younger" - resolving it further would be making numbers up.
 */
export function fitnessAgeForTest(
  norms: NormsFile,
  value: number,
  sex: Sex,
): { years: number; outOfRange: boolean } | null {
  const curve = ageCurve(norms, sex);
  if (curve.length < 2) return null;

  const direction: Direction = norms.direction;
  const capped =
    norms.value_cap !== undefined && direction === "higher_better"
      ? Math.min(value, norms.value_cap)
      : value;

  // Put everything on a "bigger is better" scale so one comparison works for
  // both directions.
  const g = (v: number) => (direction === "higher_better" ? v : -v);
  const target = g(capped);

  // Trim to the declining tail, starting at the best band.
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
  if (target <= g(worst.median)) {
    return { years: worst.age, outOfRange: target < g(worst.median) };
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
  norms: NormsRegistry;
}

/**
 * Composite fitness age: the median of the ten per-test fitness ages.
 *
 * Median rather than mean, because one clamped test at the end of the curve
 * would otherwise drag the whole number. Flagged "approx" when more than three
 * tests clamped, which is the signal that the norms simply do not reach this
 * person and the number should be read loosely.
 */
export function computeFitnessAge(input: FitnessAgeInput): FitnessAge | null {
  const perTest: FitnessAge["perTest"] = [];

  for (const t of input.tests) {
    const file = input.norms.get(t.testVariant);
    if (!file) continue;
    const r = fitnessAgeForTest(file, t.raw, input.sex);
    if (!r) continue;
    perTest.push({
      testVariant: t.testVariant,
      years: r.years,
      outOfRange: r.outOfRange,
    });
  }

  if (perTest.length === 0) return null;

  const outOfRangeCount = perTest.filter((p) => p.outOfRange).length;
  const years = Math.round(median(perTest.map((p) => p.years)) * 10) / 10;

  return {
    years,
    approx: outOfRangeCount > 3,
    outOfRangeCount,
    perTest,
  };
}

/** Chronological age at the time the battery was completed. */
export function chronologicalAge(birthDate: string, completedAt: string): number {
  return ageAt(birthDate, completedAt);
}
