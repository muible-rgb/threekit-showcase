/**
 * Scoring engine types.
 *
 * Nothing in this directory reads a file, touches a network, or reads a clock
 * it was not handed. The benchmark table arrives as an argument. That is what
 * makes the whole engine testable against literal fixtures, and what lets the
 * same code score a result under whichever benchmark version it was recorded
 * against.
 */

export type Sex = "M" | "F";
export type Direction = "higher_better" | "lower_better";

/** A = strong direct norms ... D = provisional, model-based. See docs/. */
export type EvidenceGrade = "A" | "B" | "C" | "D";

/**
 * How a cell of the table was produced. `observed` is a source band midpoint,
 * `interpolated` sits between two, `extrapolated` is outside the source's age
 * range, and `modeled` means the raw measure itself came through a proxy or
 * conversion chain (the mile from VO2max, the carry from grip strength).
 */
export type Derivation = "observed" | "interpolated" | "extrapolated" | "modeled";

/** Ages the table covers, as string keys ("18" ... "89"). */
export type ByAge<T> = Record<string, T>;

interface BenchmarkEventBase {
  unit: string;
  lower_better: boolean;
  grade: Record<Sex, EvidenceGrade>;
  /** Value everyone who could not do the test shares: 1800 s, 30 s, 0 cm, 0 m. */
  floor: number | null;
  /** Protocol ceiling: 60 s balance, 10/10 sit-to-rise. */
  ceiling: number | null;
  derivation: Record<Sex, ByAge<Derivation>>;
}

/** Continuous event: 99 quantiles per (sex, age), one per percentile 1..99. */
export interface ContinuousBenchmarkEvent extends BenchmarkEventBase {
  discrete: false;
  q: Record<Sex, ByAge<number[]>>;
}

/** Discrete event: a grid of possible raw values and the CDF at each. */
export interface DiscreteBenchmarkEvent extends BenchmarkEventBase {
  discrete: true;
  grid: number[];
  cdf: Record<Sex, ByAge<number[]>>;
}

export type BenchmarkEvent = ContinuousBenchmarkEvent | DiscreteBenchmarkEvent;

/**
 * The whole table for one benchmark version. Every statistic - age curves,
 * zero inflation, floors, ceilings - is already baked in. The scorer only
 * looks up, interpolates and handles ties.
 */
export interface BenchmarkLookup {
  version: string;
  generated: string;
  percentiles: number[];
  age_min: number;
  age_max: number;
  convention: "midrank";
  events: Record<string, BenchmarkEvent>;
}

/**
 * How one of the app's tests maps onto a benchmark event. The app records what
 * people say out loud (feet, inches); the table speaks metres and centimetres.
 * `factor` converts the stored raw value into the event's unit.
 */
export interface TestBinding {
  slug: string;
  capacity: string;
  /** The app's storage unit, for display. */
  unit: string;
  /** Key into BenchmarkLookup.events. */
  event: string;
  /** raw_in_event_units = raw * factor */
  factor: number;
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
  /** 0-100, one decimal. A real percentile among people of the same sex and age. */
  percentile: number;
  band: BandLabel;
  evidenceGrade: EvidenceGrade;
  derivation: Derivation;
  /** Grade D: there is no general-population norm behind this number yet. */
  provisional: boolean;
  /** The result sits at a floor (DNF, 0) and was scored mid-rank in that group. */
  atFloor: boolean;
  /** The result hit the protocol ceiling (60 s, 10/10). Scored mid-rank. */
  atCeiling: boolean;
}

/** Layer 3: the composite, plus everything the score screen needs. */
export interface BatteryScore {
  /**
   * Null unless all tests are present. There is no partial composite.
   *
   * It is the mean of eight percentiles and is NOT itself a percentile: a
   * mean of correlated uniforms is tighter than a uniform. Roughly, 70 is
   * strong, 80 is the top tenth, 90 the top few percent.
   */
  composite: number | null;
  /**
   * Where the composite sits among people of this sex and age, 0.5-99.5, one
   * decimal. Estimated: the population distribution of a mean of eight
   * correlated percentiles is modelled, not measured (see composite.ts). Null
   * whenever the composite is.
   */
  populationPercentile: number | null;
  band: BandLabel | null;
  testsCompleted: number;
  testsRequired: number;
  tests: TestPercentile[];
  /** Tests in the battery with no result yet. */
  missing: string[];
  fitnessAge: FitnessAge | null;
  benchmarkVersion: string;
  anyProvisional: boolean;
}

export interface FitnessAge {
  years: number;
  /** True when more than 3 tests fell outside the age range the table covers. */
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
