import { describe, expect, it } from "vitest";
import { computeFitnessAge, fitnessAgeForTest, median } from "./fitness-age";
import { withBand } from "./composite";
import { scoreTest } from "./percentile";
import { registryOf } from "./__fixtures__/norms";
import type { NormsFile } from "./types";

/** Median drops 10 units per decade from age 27 - easy to reason about. */
const linear: NormsFile = {
  test_variant: "linear",
  capacity: "grip",
  unit: "kg",
  direction: "higher_better",
  norms_version: "test",
  source: { citation: "f", url: "", population: "f", provisional: false },
  cohorts: [
    { sex: "M", age_min: 25, age_max: 29, mean: 100, sd: 10 },
    { sex: "M", age_min: 35, age_max: 39, mean: 90, sd: 10 },
    { sex: "M", age_min: 45, age_max: 49, mean: 80, sd: 10 },
    { sex: "M", age_min: 55, age_max: 59, mean: 70, sd: 10 },
  ],
};

/** Peaks at 27 - the shape that breaks a naive scan. */
const peaked: NormsFile = {
  ...linear,
  test_variant: "peaked",
  cohorts: [
    { sex: "M", age_min: 20, age_max: 24, mean: 95, sd: 10 },
    { sex: "M", age_min: 25, age_max: 29, mean: 100, sd: 10 },
    { sex: "M", age_min: 35, age_max: 39, mean: 90, sd: 10 },
    { sex: "M", age_min: 45, age_max: 49, mean: 80, sd: 10 },
  ],
};

const slower: NormsFile = {
  ...linear,
  test_variant: "slower",
  direction: "lower_better",
  cohorts: [
    { sex: "M", age_min: 25, age_max: 29, mean: 70, sd: 8 },
    { sex: "M", age_min: 35, age_max: 39, mean: 80, sd: 8 },
    { sex: "M", age_min: 45, age_max: 49, mean: 90, sd: 8 },
  ],
};

const cutpoints: NormsFile = {
  ...linear,
  test_variant: "cuts",
  cohorts: [
    { sex: "M", age_min: 25, age_max: 29, percentiles: { "50": 100 } as never },
    { sex: "M", age_min: 45, age_max: 49, percentiles: { "50": 80 } as never },
  ],
};

describe("median", () => {
  it("takes the middle of an odd list", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("averages the middle pair of an even list", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("is NaN for an empty list", () => {
    expect(Number.isNaN(median([]))).toBe(true);
  });
});

describe("fitnessAgeForTest", () => {
  it("returns the band midpoint when the result is exactly that band's median", () => {
    expect(fitnessAgeForTest(linear, 90, "M")).toEqual({ years: 37, outOfRange: false });
    expect(fitnessAgeForTest(linear, 80, "M")).toEqual({ years: 47, outOfRange: false });
  });

  it("interpolates between band midpoints", () => {
    // Halfway between the 37-year-old median (90) and the 47-year-old one (80).
    expect(fitnessAgeForTest(linear, 85, "M")).toEqual({ years: 42, outOfRange: false });
  });

  it("clamps and flags a result better than the youngest median", () => {
    expect(fitnessAgeForTest(linear, 150, "M")).toEqual({ years: 27, outOfRange: true });
  });

  it("clamps and flags a result worse than the oldest median", () => {
    expect(fitnessAgeForTest(linear, 10, "M")).toEqual({ years: 57, outOfRange: true });
  });

  it("does not flag a result sitting exactly on an end median", () => {
    expect(fitnessAgeForTest(linear, 100, "M")).toEqual({ years: 27, outOfRange: false });
    expect(fitnessAgeForTest(linear, 70, "M")).toEqual({ years: 57, outOfRange: false });
  });

  it("reads a peaked curve from the peak downwards", () => {
    // 95 is also the median for a 22-year-old, but the meaningful answer is on
    // the declining side: as good as the average 32-year-old.
    expect(fitnessAgeForTest(peaked, 95, "M")).toEqual({ years: 32, outOfRange: false });
  });

  it("handles lower-is-better - a faster time means a younger fitness age", () => {
    expect(fitnessAgeForTest(slower, 80, "M")).toEqual({ years: 37, outOfRange: false });
    expect(fitnessAgeForTest(slower, 75, "M")).toEqual({ years: 32, outOfRange: false });
    expect(fitnessAgeForTest(slower, 50, "M")).toEqual({ years: 27, outOfRange: true });
    expect(fitnessAgeForTest(slower, 200, "M")).toEqual({ years: 47, outOfRange: true });
  });

  it("uses the 50th cut-point when the file has no mean", () => {
    expect(fitnessAgeForTest(cutpoints, 100, "M")).toEqual({ years: 27, outOfRange: false });
    expect(fitnessAgeForTest(cutpoints, 90, "M")).toEqual({ years: 37, outOfRange: false });
  });

  it("respects the protocol cap", () => {
    const capped = { ...linear, value_cap: 100 };
    expect(fitnessAgeForTest(capped, 500, "M")).toEqual({ years: 27, outOfRange: false });
  });

  it("returns null when a file has fewer than two usable bands", () => {
    expect(
      fitnessAgeForTest({ ...linear, cohorts: [linear.cohorts[0]] }, 90, "M"),
    ).toBeNull();
  });
});

describe("computeFitnessAge", () => {
  const files = [linear, peaked, slower].map((f, i) => ({ ...f, test_variant: `t${i}` }));
  const norms = registryOf(...files);

  function scoreOf(values: number[]) {
    return files.map((f, i) => withBand(scoreTest(f, values[i], "M", 42)));
  }

  it("is the median of the per-test fitness ages", () => {
    // linear 85 -> 42, peaked 90 -> 37, slower 80 -> 37. Median 37.
    const fa = computeFitnessAge({
      sex: "M",
      birthDate: "1984-01-01",
      completedAt: "2026-06-01T00:00:00.000Z",
      tests: scoreOf([85, 90, 80]),
      norms,
    });
    expect(fa!.years).toBe(37);
    expect(fa!.perTest).toHaveLength(3);
  });

  it("is not dragged around by a single clamped test", () => {
    // One absurd result clamps to 27; the median holds.
    const fa = computeFitnessAge({
      sex: "M",
      birthDate: "1984-01-01",
      completedAt: "2026-06-01T00:00:00.000Z",
      tests: scoreOf([9999, 90, 80]),
      norms,
    });
    expect(fa!.years).toBe(37);
    expect(fa!.outOfRangeCount).toBe(1);
    expect(fa!.approx).toBe(false);
  });

  it("is marked approx once more than three tests fall outside the norms", () => {
    const wide = Array.from({ length: 10 }, (_, i) => ({
      ...linear,
      test_variant: `w${i}`,
    }));
    const wideNorms = registryOf(...wide);
    const tests = wide.map((f, i) =>
      // Four absurd results, six normal ones.
      withBand(scoreTest(f, i < 4 ? 9999 : 85, "M", 42)),
    );
    const fa = computeFitnessAge({
      sex: "M",
      birthDate: "1984-01-01",
      completedAt: "2026-06-01T00:00:00.000Z",
      tests,
      norms: wideNorms,
    });
    expect(fa!.outOfRangeCount).toBe(4);
    expect(fa!.approx).toBe(true);
  });

  it("is not marked approx at exactly three out of range", () => {
    const wide = Array.from({ length: 10 }, (_, i) => ({
      ...linear,
      test_variant: `w${i}`,
    }));
    const wideNorms = registryOf(...wide);
    const tests = wide.map((f, i) => withBand(scoreTest(f, i < 3 ? 9999 : 85, "M", 42)));
    const fa = computeFitnessAge({
      sex: "M",
      birthDate: "1984-01-01",
      completedAt: "2026-06-01T00:00:00.000Z",
      tests,
      norms: wideNorms,
    });
    expect(fa!.outOfRangeCount).toBe(3);
    expect(fa!.approx).toBe(false);
  });

  it("returns null when no test can be resolved", () => {
    expect(
      computeFitnessAge({
        sex: "M",
        birthDate: "1984-01-01",
        completedAt: "2026-06-01T00:00:00.000Z",
        tests: [],
        norms,
      }),
    ).toBeNull();
  });
});
