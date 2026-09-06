import { createScorer } from "./benchmark";
import { ageAt } from "./cohort";
import { computeFitnessAge } from "./fitness-age";
import { normalCdf } from "./normal";
import type {
  BandLabel,
  BatteryScore,
  BenchmarkLookup,
  RawResult,
  Sex,
  TestBinding,
  TestPercentile,
} from "./types";

export const BANDS: Array<{ min: number; max: number; label: BandLabel }> = [
  { min: 90, max: 100, label: "Elite" },
  { min: 75, max: 89.9999, label: "Strong" },
  { min: 50, max: 74.9999, label: "Solid" },
  { min: 25, max: 49.9999, label: "Below average" },
  { min: 0, max: 24.9999, label: "At risk" },
];

/**
 * Band boundaries are inclusive at the bottom. 90.0 is Elite, 89.9 is Strong.
 */
export function bandFor(percentile: number): BandLabel {
  if (percentile >= 90) return "Elite";
  if (percentile >= 75) return "Strong";
  if (percentile >= 50) return "Solid";
  if (percentile >= 25) return "Below average";
  return "At risk";
}

/**
 * The composite as a percentile of the population.
 *
 * Each of the eight inputs is a percentile, so uniform on 0-100 with variance
 * 100^2 / 12. The mean of eight such variables with pairwise correlation r has
 * variance (100^2 / 12) / 8 * (1 + 7r). The methodology report puts r at
 * about 0.4 for physical capacities in adults, which gives a standard
 * deviation near 20, and by the central limit theorem the mean is close to
 * normal. So an overall of 90 is about the top 2%, not the top 10%.
 *
 * This is a model, not a measurement, and it is the same at every age because
 * every input is already age- and sex-adjusted. It is labelled estimated
 * wherever it appears, and the plan is to replace it with an empirical
 * re-normalisation once the app has enough real results.
 */
export const COMPOSITE_CORRELATION = 0.4;
export const COMPOSITE_SD = Math.sqrt(((100 * 100) / 12 / 8) * (1 + 7 * COMPOSITE_CORRELATION));

export function populationPercentile(composite: number | null): number | null {
  if (composite === null) return null;
  const p = 100 * normalCdf((composite - 50) / COMPOSITE_SD);
  // Same convention as the table: off the end reads 0.5 or 99.5.
  return Math.min(99.5, Math.max(0.5, Math.round(p * 10) / 10));
}

export interface ScoreBatteryInput {
  sex: Sex;
  birthDate: string;
  /** The tests this battery requires, in order, each bound to a benchmark event. */
  tests: TestBinding[];
  results: RawResult[];
  lookup: BenchmarkLookup;
  /** Defaults to the latest result timestamp. Age is taken at time of test. */
  completedAt?: string;
}

/**
 * Layer 3. The composite is the unweighted mean of eight percentiles, to one
 * decimal, and it does not exist until all eight are there.
 *
 * There is no partial composite and no weighting parameter. Both omissions are
 * deliberate: a partial composite lets you skip the test you are worst at, and
 * a weighting parameter turns an argument about physiology into an argument
 * about settings. The methodology report reaches the same conclusion from the
 * other direction: equal weights, unchanged, until app data allow an empirical
 * re-normalisation.
 */
export function scoreBattery(input: ScoreBatteryInput): BatteryScore {
  const { sex, birthDate, tests: bindings, results, lookup } = input;
  const scorer = createScorer(lookup);
  const slugs = bindings.map((b) => b.slug);

  // Latest result wins per test. Results are immutable, so a correction is a
  // newer row, and "newest" is how a correction takes effect.
  const latest = new Map<string, RawResult>();
  for (const r of results) {
    if (!slugs.includes(r.testVariant)) continue;
    const seen = latest.get(r.testVariant);
    if (!seen || new Date(r.recordedAt) >= new Date(seen.recordedAt)) {
      latest.set(r.testVariant, r);
    }
  }

  const completedAt =
    input.completedAt ??
    [...latest.values()]
      .map((r) => r.recordedAt)
      .sort()
      .pop() ??
    new Date().toISOString();

  const tests: TestPercentile[] = [];
  const missing: string[] = [];
  let anyProvisional = false;

  for (const binding of bindings) {
    const result = latest.get(binding.slug);
    if (!result) {
      missing.push(binding.slug);
      continue;
    }

    // Age at the time of THAT test, not age today. A battery run across a
    // birthday is rare but it should not silently shift the comparison group.
    const age = ageAt(birthDate, result.recordedAt);
    const scored = scorer.scoreEvent(
      binding.event,
      sex,
      age,
      result.value * binding.factor,
    );
    if (scored.provisional) anyProvisional = true;

    tests.push({
      testVariant: binding.slug,
      capacity: binding.capacity,
      unit: binding.unit,
      raw: result.value,
      percentile: scored.score,
      band: bandFor(scored.score),
      evidenceGrade: scored.evidenceGrade,
      derivation: scored.derivation,
      provisional: scored.provisional,
      atFloor: scored.atFloor,
      atCeiling: scored.atCeiling,
    });
  }

  const complete = missing.length === 0 && tests.length === bindings.length;

  const composite = complete
    ? Math.round(
        (tests.reduce((sum, t) => sum + t.percentile, 0) / tests.length) * 10,
      ) / 10
    : null;

  return {
    composite,
    populationPercentile: populationPercentile(composite),
    band: composite === null ? null : bandFor(composite),
    testsCompleted: tests.length,
    testsRequired: bindings.length,
    tests,
    missing,
    fitnessAge: complete
      ? computeFitnessAge({ sex, birthDate, completedAt, tests, bindings, lookup })
      : null,
    benchmarkVersion: lookup.version,
    anyProvisional,
  };
}

/**
 * The live crew board needs something to sort by mid-session, but it must not
 * be called a Longevity Score. This is explicitly a different number with a
 * different name so no surface can confuse them.
 */
export function runningAverage(tests: TestPercentile[]): number | null {
  if (tests.length === 0) return null;
  return (
    Math.round(
      (tests.reduce((sum, t) => sum + t.percentile, 0) / tests.length) * 10,
    ) / 10
  );
}
