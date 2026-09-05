/**
 * Scoring engine types.
 *
 * Nothing in this directory reads a file, touches a network, or reads a clock
 * it was not handed. Norms arrive as a NormsRegistry argument. That is what
 * makes the whole engine testable with literal fixtures.
 */

export type Sex = "M" | "F";
export type Direction = "higher_better" | "lower_better";

/** Percentile cut-points, keyed by percentile as a string. e.g. { "50": 29 } */
export type CutPoints = Record<string, number>;

export interface NormCohort {
  sex: Sex;
  age_min: number;
  age_max: number;
  /** Either mean + sd ... */
  mean?: number;
  sd?: number;
  /** ... or percentile cut-points. Exactly one of the two forms. */
  percentiles?: CutPoints;
}

export interface NormsSource {
  citation: string;
  url: string;
  population: string;
  provisional: boolean;
  /** False until a human has checked the numbers against the source document. */
  transcription_verified?: boolean;
  notes?: string;
  generated_by?: string;
  model?: Record<string, unknown>;
}

export interface NormsFile {
  test_variant: string;
  capacity: string;
  unit: string;
  direction: Direction;
  norms_version: string;
  /** Protocol ceiling, e.g. the 60s cap on the balance test. */
  value_cap?: number;
  source: NormsSource;
  cohorts: NormCohort[];
}

/** The engine's only dependency. Hand it a Map in tests, a loader in the app. */
export interface NormsRegistry {
  get(testVariantSlug: string): NormsFile | undefined;
  /** Every slug the registry knows about. Used by /admin/norms and /methodology. */
  slugs(): string[];
}

export type BandLabel =
  | "Elite"
  | "Strong"
  | "Solid"
  | "Below average"
  | "At risk";

/** Layer 1: an immutable raw result. */
export interface RawResult {
  testVariant: string;
  value: number;
  recordedAt: string; // ISO
}

/** Layer 2: one test's cohort-relative score. */
export interface TestPercentile {
  testVariant: string;
  capacity: string;
  unit: string;
  raw: number;
  percentile: number; // 1.0 - 99.0, one decimal
  band: BandLabel;
  /** How the percentile was derived. Shown in tooltips, useful in bug reports. */
  method: "mean_sd" | "cut_points";
  provisional: boolean;
  /** Set when the raw value sits outside the range the cut-points cover. */
  extrapolated: boolean;
}

/** Layer 3: the composite, plus everything the score screen needs. */
export interface BatteryScore {
  /** Null unless all 10 tests are present. There is no partial composite. */
  composite: number | null;
  band: BandLabel | null;
  testsCompleted: number;
  testsRequired: number;
  tests: TestPercentile[];
  /** Tests in the battery with no result yet. */
  missing: string[];
  fitnessAge: FitnessAge | null;
  normsVersion: string;
  anyProvisional: boolean;
}

export interface FitnessAge {
  years: number;
  /** True when more than 3 tests fell outside the age range the norms cover. */
  approx: boolean;
  outOfRangeCount: number;
  perTest: Array<{ testVariant: string; years: number; outOfRange: boolean }>;
}

export interface Cohort {
  sex: Sex;
  ageBandMin: number;
  ageBandMax: number;
  age: number;
}
