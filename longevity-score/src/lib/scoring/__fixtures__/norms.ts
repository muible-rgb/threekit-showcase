import type { NormsFile, NormsRegistry } from "../types";

/**
 * Literal fixtures. The engine tests never read /data/norms - a change to a
 * published norm must not be able to turn an engine test red.
 */

export const meanSdHigher: NormsFile = {
  test_variant: "fixture_mean_sd_higher",
  capacity: "grip",
  unit: "kg",
  direction: "higher_better",
  norms_version: "test",
  source: {
    citation: "fixture",
    url: "",
    population: "fixture",
    provisional: false,
  },
  cohorts: [
    { sex: "M", age_min: 20, age_max: 24, mean: 50, sd: 10 },
    { sex: "M", age_min: 25, age_max: 29, mean: 52, sd: 10 },
    { sex: "M", age_min: 30, age_max: 34, mean: 50, sd: 10 },
    { sex: "M", age_min: 35, age_max: 39, mean: 48, sd: 10 },
    { sex: "M", age_min: 40, age_max: 44, mean: 46, sd: 10 },
    { sex: "M", age_min: 45, age_max: 49, mean: 44, sd: 10 },
    { sex: "F", age_min: 40, age_max: 44, mean: 30, sd: 6 },
    { sex: "F", age_min: 45, age_max: 49, mean: 28, sd: 6 },
  ],
};

export const meanSdLower: NormsFile = {
  test_variant: "fixture_mean_sd_lower",
  capacity: "speed_endurance",
  unit: "s",
  direction: "lower_better",
  norms_version: "test",
  source: { citation: "fixture", url: "", population: "fixture", provisional: true },
  cohorts: [
    { sex: "M", age_min: 30, age_max: 34, mean: 75, sd: 10 },
    { sex: "M", age_min: 40, age_max: 44, mean: 80, sd: 10 },
    { sex: "M", age_min: 50, age_max: 54, mean: 90, sd: 10 },
  ],
};

export const cutPointsHigher: NormsFile = {
  test_variant: "fixture_cut_points_higher",
  capacity: "push_endurance",
  unit: "reps",
  direction: "higher_better",
  norms_version: "test",
  source: { citation: "fixture", url: "", population: "fixture", provisional: false },
  cohorts: [
    {
      sex: "M",
      age_min: 40,
      age_max: 44,
      percentiles: { "10": 10, "25": 15, "50": 20, "75": 30, "90": 40 },
    },
    {
      sex: "M",
      age_min: 50,
      age_max: 54,
      percentiles: { "10": 6, "25": 10, "50": 14, "75": 21, "90": 28 },
    },
  ],
};

export const cutPointsLower: NormsFile = {
  test_variant: "fixture_cut_points_lower",
  capacity: "speed_endurance",
  unit: "s",
  direction: "lower_better",
  norms_version: "test",
  source: { citation: "fixture", url: "", population: "fixture", provisional: false },
  cohorts: [
    {
      sex: "M",
      age_min: 40,
      age_max: 44,
      // Lower is better, so the values descend as the percentile rises.
      percentiles: { "10": 110, "25": 100, "50": 90, "75": 80, "90": 70 },
    },
  ],
};

export const cappedHigher: NormsFile = {
  test_variant: "fixture_capped",
  capacity: "balance",
  unit: "s",
  direction: "higher_better",
  norms_version: "test",
  value_cap: 60,
  source: { citation: "fixture", url: "", population: "fixture", provisional: true },
  cohorts: [
    { sex: "M", age_min: 40, age_max: 44, mean: 25, sd: 15 },
    { sex: "M", age_min: 50, age_max: 54, mean: 18, sd: 12 },
  ],
};

export function registryOf(...files: NormsFile[]): NormsRegistry {
  const map = new Map(files.map((f) => [f.test_variant, f]));
  return {
    get: (slug) => map.get(slug),
    slugs: () => [...map.keys()],
  };
}
