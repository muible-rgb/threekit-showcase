import { findCohort } from "./cohort";
import { normalCdf } from "./normal";
import type {
  Direction,
  NormCohort,
  NormsFile,
  Sex,
  TestPercentile,
} from "./types";

/** Nothing is ever 0 and nothing is ever 100. Being last is not being nobody. */
export const PERCENTILE_FLOOR = 1;
export const PERCENTILE_CAP = 99;

export function clampPercentile(p: number): number {
  return Math.min(PERCENTILE_CAP, Math.max(PERCENTILE_FLOOR, p));
}

export function roundPercentile(p: number): number {
  return Math.round(p * 10) / 10;
}

export interface PercentileResult {
  percentile: number;
  method: "mean_sd" | "cut_points";
  extrapolated: boolean;
  /** True when the person's age fell outside the bands the file covers. */
  cohortClamped: boolean;
}

/**
 * Mean/SD path. Smooth by construction: a 1kg improvement always moves the
 * percentile, which is the whole reason to prefer this form over cut-points.
 */
function fromMeanSd(
  value: number,
  mean: number,
  sd: number,
  direction: Direction,
): number {
  if (sd <= 0) {
    // Degenerate norm. Everyone at the mean sits at the median; better or worse
    // pins to the rail. Not a real case, but it must not produce NaN.
    if (value === mean) return 50;
    const better = direction === "higher_better" ? value > mean : value < mean;
    return better ? PERCENTILE_CAP : PERCENTILE_FLOOR;
  }

  let z = (value - mean) / sd;
  if (direction === "lower_better") z = -z;
  return normalCdf(z) * 100;
}

/**
 * Cut-point path. Linear interpolation between published points.
 *
 * Outside the covered range we continue the slope of the nearest segment
 * rather than snapping to the edge percentile. Snapping would make every
 * elite result land on exactly 90.0, which destroys ordering at the top of the
 * board - the one place a crew actually cares about ordering. The result is
 * flagged `extrapolated` so the UI can say so, and it is still clamped to 1-99.
 */
function fromCutPoints(
  value: number,
  points: Record<string, number>,
  direction: Direction,
): { percentile: number; extrapolated: boolean } {
  const entries = Object.entries(points)
    .map(([pct, v]) => ({ pct: Number(pct), value: v }))
    .filter((e) => Number.isFinite(e.pct) && Number.isFinite(e.value))
    .sort((a, b) => a.pct - b.pct);

  if (entries.length === 0) {
    throw new Error("cut-point cohort has no usable percentiles");
  }
  if (entries.length === 1) {
    const only = entries[0];
    if (value === only.value) return { percentile: only.pct, extrapolated: false };
    const better =
      direction === "higher_better" ? value > only.value : value < only.value;
    return {
      percentile: better ? PERCENTILE_CAP : PERCENTILE_FLOOR,
      extrapolated: true,
    };
  }

  // Work on a scale where "bigger is a higher percentile", so one interpolation
  // handles both directions.
  const scale = (v: number) => (direction === "higher_better" ? v : -v);
  const pts = entries.map((e) => ({ pct: e.pct, x: scale(e.value) }));
  const x = scale(value);

  const first = pts[0];
  const last = pts[pts.length - 1];

  if (x <= first.x) {
    const next = pts[1];
    const slope = (next.pct - first.pct) / (next.x - first.x);
    const extrapolated = x < first.x;
    return {
      percentile: first.pct + slope * (x - first.x),
      extrapolated,
    };
  }

  if (x >= last.x) {
    const prev = pts[pts.length - 2];
    const slope = (last.pct - prev.pct) / (last.x - prev.x);
    const extrapolated = x > last.x;
    return { percentile: last.pct + slope * (x - last.x), extrapolated };
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const lo = pts[i];
    const hi = pts[i + 1];
    if (x >= lo.x && x <= hi.x) {
      // Guard against duplicated cut-point values (happens in coarse tables).
      if (hi.x === lo.x) return { percentile: hi.pct, extrapolated: false };
      const t = (x - lo.x) / (hi.x - lo.x);
      return { percentile: lo.pct + t * (hi.pct - lo.pct), extrapolated: false };
    }
  }

  /* c8 ignore next */
  throw new Error("cut-point interpolation fell through");
}

/** Percentile for a raw value against one specific norm cohort. */
export function percentileInCohort(
  value: number,
  cohort: NormCohort,
  direction: Direction,
): { percentile: number; method: "mean_sd" | "cut_points"; extrapolated: boolean } {
  if (cohort.mean !== undefined && cohort.sd !== undefined) {
    return {
      percentile: fromMeanSd(value, cohort.mean, cohort.sd, direction),
      method: "mean_sd",
      extrapolated: false,
    };
  }
  if (cohort.percentiles) {
    const r = fromCutPoints(value, cohort.percentiles, direction);
    return { percentile: r.percentile, method: "cut_points", extrapolated: r.extrapolated };
  }
  throw new Error(
    "norm cohort has neither mean/sd nor percentiles; the norms file is malformed",
  );
}

/** Percentile for a raw value, for a person of this sex and age. */
export function percentileFor(
  norms: NormsFile,
  value: number,
  sex: Sex,
  age: number,
): PercentileResult {
  const found = findCohort(norms, sex, age);
  if (!found) {
    throw new Error(
      `norms file ${norms.test_variant} has no cohorts for sex ${sex}`,
    );
  }

  // A protocol ceiling (the 60s balance cap) is a hard stop: everyone who caps
  // out is at the top of what the test can measure, so they share the cap.
  const capped =
    norms.value_cap !== undefined && norms.direction === "higher_better"
      ? Math.min(value, norms.value_cap)
      : value;

  const raw = percentileInCohort(capped, found.cohort, norms.direction);
  return {
    percentile: roundPercentile(clampPercentile(raw.percentile)),
    method: raw.method,
    extrapolated: raw.extrapolated,
    cohortClamped: found.clamped,
  };
}

/** The full Layer 2 record for one test. */
export function scoreTest(
  norms: NormsFile,
  value: number,
  sex: Sex,
  age: number,
): Omit<TestPercentile, "band"> {
  const r = percentileFor(norms, value, sex, age);
  return {
    testVariant: norms.test_variant,
    capacity: norms.capacity,
    unit: norms.unit,
    raw: value,
    percentile: r.percentile,
    method: r.method,
    provisional: norms.source.provisional,
    extrapolated: r.extrapolated || r.cohortClamped,
  };
}
