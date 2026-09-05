import { ageAt } from "./cohort";
import { computeFitnessAge } from "./fitness-age";
import { scoreTest } from "./percentile";
import type {
  BandLabel,
  BatteryScore,
  NormsRegistry,
  RawResult,
  Sex,
  TestPercentile,
} from "./types";

export const BANDS: Array<{ min: number; max: number; label: BandLabel }> = [
  { min: 90, max: 99, label: "Elite" },
  { min: 75, max: 89.9999, label: "Strong" },
  { min: 50, max: 74.9999, label: "Solid" },
  { min: 25, max: 49.9999, label: "Below average" },
  { min: 1, max: 24.9999, label: "At risk" },
];

/**
 * Band boundaries are inclusive at the bottom. 90.0 is Elite, 89.9 is Strong.
 * Percentiles are floored at 1 and capped at 99 before they get here, so the
 * ends can never fall through.
 */
export function bandFor(percentile: number): BandLabel {
  if (percentile >= 90) return "Elite";
  if (percentile >= 75) return "Strong";
  if (percentile >= 50) return "Solid";
  if (percentile >= 25) return "Below average";
  return "At risk";
}

export function withBand(t: Omit<TestPercentile, "band">): TestPercentile {
  return { ...t, band: bandFor(t.percentile) };
}

export interface ScoreBatteryInput {
  sex: Sex;
  birthDate: string;
  /** The test variant slugs this battery version requires, in order. */
  batteryTests: string[];
  results: RawResult[];
  norms: NormsRegistry;
  /** Defaults to the latest result timestamp. Age is taken at time of test. */
  completedAt?: string;
}

/**
 * Layer 3. The composite is the unweighted mean of ten percentiles, to one
 * decimal, and it does not exist until all ten are there.
 *
 * There is no partial composite and no weighting parameter. Both omissions are
 * deliberate: a partial composite lets you skip the test you are worst at, and
 * a weighting parameter turns an argument about physiology into an argument
 * about settings.
 */
export function scoreBattery(input: ScoreBatteryInput): BatteryScore {
  const { sex, birthDate, batteryTests, results, norms } = input;

  // Latest result wins per test. Results are immutable, so a correction is a
  // newer row, and "newest" is how a correction takes effect.
  const latest = new Map<string, RawResult>();
  for (const r of results) {
    if (!batteryTests.includes(r.testVariant)) continue;
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
  let normsVersion = "v1";
  let anyProvisional = false;

  for (const slug of batteryTests) {
    const result = latest.get(slug);
    const file = norms.get(slug);

    if (!result || !file) {
      missing.push(slug);
      continue;
    }

    normsVersion = file.norms_version;
    // Age at the time of THAT test, not age today. A battery run across a
    // birthday is rare but it should not silently shift a cohort.
    const age = ageAt(birthDate, result.recordedAt);
    const scored = withBand(scoreTest(file, result.value, sex, age));
    if (scored.provisional) anyProvisional = true;
    tests.push(scored);
  }

  const complete = missing.length === 0 && tests.length === batteryTests.length;

  const composite = complete
    ? Math.round(
        (tests.reduce((sum, t) => sum + t.percentile, 0) / tests.length) * 10,
      ) / 10
    : null;

  return {
    composite,
    band: composite === null ? null : bandFor(composite),
    testsCompleted: tests.length,
    testsRequired: batteryTests.length,
    tests,
    missing,
    fitnessAge: complete
      ? computeFitnessAge({
          sex,
          birthDate,
          completedAt,
          tests,
          norms,
        })
      : null,
    normsVersion,
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
