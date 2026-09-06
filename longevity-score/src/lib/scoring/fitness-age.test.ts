import { describe, expect, it } from "vitest";
import { computeFitnessAge, fitnessAgeForTest, median } from "./fitness-age";
import { createScorer } from "./benchmark";
import {
  AGE_MAX,
  AGE_MIN,
  bindingOf,
  continuousEvent,
  discreteEvent,
  eightTestFixture,
  lookupOf,
} from "./__fixtures__/lookup";
import type { TestPercentile } from "./types";

/** Median falls one unit a year from 100 at 18: age = 118 - median. */
const linear = continuousEvent({ median: (age) => 100 - (age - AGE_MIN), spread: 10 });

/** Rises to a peak of 100 at 30, then falls one a year - the shape that breaks a naive scan. */
const peaked = continuousEvent({
  median: (age) => (age <= 30 ? 88 + (age - AGE_MIN) : 100 - (age - 30)),
  spread: 10,
});

/** Lower is better, and gets slower with age: 60 s at 18, one second a year. */
const slower = continuousEvent({ median: (age) => 60 + (age - AGE_MIN), spread: 8, lower_better: true });

/** A discrete score whose median steps: 5 to age 40, then 4 to 60, then 3. */
const stepped = discreteEvent({
  grid: Array.from({ length: 11 }, (_, i) => i),
  cdf: (age) => {
    const m = age <= 40 ? 5 : age <= 60 ? 4 : 3;
    return Array.from({ length: 11 }, (_, g) => (g < m ? 0.25 : g === m ? 0.75 : 1));
  },
});

const lookup = lookupOf({ linear, peaked, slower, stepped });
const scorer = createScorer(lookup);
const fa = (event: string, raw: number, factor = 1) =>
  fitnessAgeForTest(scorer, bindingOf(event, event, factor), raw, "M", AGE_MIN, AGE_MAX);

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
  it("returns the age whose median this result equals", () => {
    expect(fa("linear", 76)).toEqual({ years: 42, outOfRange: false });
    expect(fa("linear", 60)).toEqual({ years: 58, outOfRange: false });
  });

  it("interpolates between years", () => {
    expect(fa("linear", 75.5)).toEqual({ years: 42.5, outOfRange: false });
  });

  it("clamps and flags a result better than the youngest median", () => {
    expect(fa("linear", 150)).toEqual({ years: AGE_MIN, outOfRange: true });
  });

  it("clamps and flags a result worse than the oldest median", () => {
    expect(fa("linear", 10)).toEqual({ years: AGE_MAX, outOfRange: true });
  });

  it("does not flag a result sitting exactly on an end median", () => {
    expect(fa("linear", 100)).toEqual({ years: AGE_MIN, outOfRange: false });
    expect(fa("linear", 29)).toEqual({ years: AGE_MAX, outOfRange: false });
  });

  it("reads a peaked curve from the peak downwards", () => {
    // 95 is also the median for a 25-year-old, but the meaningful answer is on
    // the declining side: as good as the average 35-year-old.
    expect(fa("peaked", 95)).toEqual({ years: 35, outOfRange: false });
    // Better than the peak itself is out of range at the peak age, not at 18.
    expect(fa("peaked", 101)).toEqual({ years: 30, outOfRange: true });
  });

  it("handles lower-is-better - a faster time means a younger fitness age", () => {
    expect(fa("slower", 84)).toEqual({ years: 42, outOfRange: false });
    expect(fa("slower", 74)).toEqual({ years: 32, outOfRange: false });
    expect(fa("slower", 50)).toEqual({ years: AGE_MIN, outOfRange: true });
    expect(fa("slower", 500)).toEqual({ years: AGE_MAX, outOfRange: true });
  });

  it("reads a stepped discrete median at the younger end of its plateau", () => {
    expect(fa("stepped", 5)).toEqual({ years: AGE_MIN, outOfRange: false });
    expect(fa("stepped", 4)).toEqual({ years: 41, outOfRange: false });
    expect(fa("stepped", 3)).toEqual({ years: 61, outOfRange: false });
    expect(fa("stepped", 1)).toEqual({ years: AGE_MAX, outOfRange: true });
  });

  it("converts the app's unit before reading the curve", () => {
    // Stored as 38 in the app, scored as 76 in the table.
    expect(fa("linear", 38, 2)).toEqual({ years: 42, outOfRange: false });
  });

  it("returns null for an event the table does not have", () => {
    expect(fa("nope", 50)).toBeNull();
  });
});

describe("computeFitnessAge", () => {
  const { lookup: eight, bindings } = eightTestFixture();

  /** Only raw and testVariant matter here; the rest is filler. */
  function tests(raws: number[]): TestPercentile[] {
    return raws.map((raw, i) => ({
      testVariant: `t${i}`,
      capacity: `c${i}`,
      unit: "u",
      raw,
      percentile: 50,
      band: "Solid",
      evidenceGrade: "B",
      derivation: "observed",
      provisional: false,
      atFloor: false,
      atCeiling: false,
    }));
  }
  const base = { sex: "M" as const, birthDate: "1984-01-01", completedAt: "2026-06-01T00:00:00.000Z", bindings, lookup: eight };

  it("is the median of the per-test fitness ages", () => {
    // Medians: raw 76 -> 42, raw 71 -> 47, raw 81 -> 37. Eight values, median of the middle pair.
    const r = computeFitnessAge({ ...base, tests: tests([76, 71, 81, 76, 71, 81, 76, 66]) });
    // Sorted ages: 37, 37, 42, 42, 42, 47, 47, 52 -> median 42.
    expect(r!.years).toBe(42);
    expect(r!.perTest).toHaveLength(8);
  });

  it("is not dragged around by a single clamped test", () => {
    const r = computeFitnessAge({ ...base, tests: tests([9999, 76, 76, 76, 76, 76, 76, 76]) });
    expect(r!.years).toBe(42);
    expect(r!.outOfRangeCount).toBe(1);
    expect(r!.approx).toBe(false);
  });

  it("is marked approx once more than three tests fall outside the table", () => {
    const r = computeFitnessAge({ ...base, tests: tests([9999, 9999, 9999, 9999, 76, 76, 76, 76]) });
    expect(r!.outOfRangeCount).toBe(4);
    expect(r!.approx).toBe(true);
  });

  it("is not marked approx at exactly three out of range", () => {
    const r = computeFitnessAge({ ...base, tests: tests([9999, 9999, 9999, 76, 76, 76, 76, 76]) });
    expect(r!.outOfRangeCount).toBe(3);
    expect(r!.approx).toBe(false);
  });

  it("returns null when no test can be resolved", () => {
    expect(computeFitnessAge({ ...base, tests: [] })).toBeNull();
  });
});
