import { describe, expect, it } from "vitest";
import { bandFor, runningAverage, scoreBattery } from "./composite";
import { registryOf } from "./__fixtures__/norms";
import type { NormsFile, RawResult, TestPercentile } from "./types";

/** Ten identical-shaped fixture files so we can drive a whole battery. */
const TEN = Array.from({ length: 10 }, (_, i): NormsFile => ({
  test_variant: `t${i}`,
  capacity: `c${i}`,
  unit: "u",
  direction: "higher_better",
  norms_version: "test",
  source: {
    citation: "fixture",
    url: "",
    population: "fixture",
    provisional: i === 9, // one provisional file in the set
  },
  cohorts: [
    { sex: "M", age_min: 25, age_max: 29, mean: 110, sd: 10 },
    { sex: "M", age_min: 40, age_max: 44, mean: 100, sd: 10 },
    { sex: "M", age_min: 60, age_max: 64, mean: 80, sd: 10 },
  ],
}));

const norms = registryOf(...TEN);
const BATTERY = TEN.map((f) => f.test_variant);

function results(values: number[], at = "2026-06-01T10:00:00.000Z"): RawResult[] {
  return values.map((value, i) => ({
    testVariant: `t${i}`,
    value,
    recordedAt: at,
  }));
}

const BASE = { sex: "M" as const, birthDate: "1984-01-01", batteryTests: BATTERY, norms };

describe("bandFor", () => {
  it("labels each band", () => {
    expect(bandFor(99)).toBe("Elite");
    expect(bandFor(80)).toBe("Strong");
    expect(bandFor(60)).toBe("Solid");
    expect(bandFor(30)).toBe("Below average");
    expect(bandFor(5)).toBe("At risk");
  });

  it("is inclusive at the bottom of each band", () => {
    expect(bandFor(90)).toBe("Elite");
    expect(bandFor(75)).toBe("Strong");
    expect(bandFor(50)).toBe("Solid");
    expect(bandFor(25)).toBe("Below average");
    expect(bandFor(1)).toBe("At risk");
  });

  it("puts one tenth below each boundary in the band beneath", () => {
    expect(bandFor(89.9)).toBe("Strong");
    expect(bandFor(74.9)).toBe("Solid");
    expect(bandFor(49.9)).toBe("Below average");
    expect(bandFor(24.9)).toBe("At risk");
  });
});

describe("composite", () => {
  it("is the unweighted mean of ten percentiles", () => {
    const score = scoreBattery({ ...BASE, results: results(Array(10).fill(100)) });
    expect(score.composite).toBe(50);
    expect(score.band).toBe("Solid");
    expect(score.testsCompleted).toBe(10);
  });

  it("reports one decimal, not a rounded integer", () => {
    // Percentiles chosen so the mean lands on a tenth.
    const score = scoreBattery({
      ...BASE,
      results: results([110, 110, 110, 100, 100, 100, 100, 100, 100, 100]),
    });
    expect(score.composite).not.toBeNull();
    expect(score.composite! % 1).not.toBe(0);
    expect(score.composite! * 10).toBe(Math.round(score.composite! * 10));
  });

  it("is null when a single test is missing", () => {
    const score = scoreBattery({ ...BASE, results: results(Array(9).fill(100)) });
    expect(score.composite).toBeNull();
    expect(score.band).toBeNull();
    expect(score.testsCompleted).toBe(9);
    expect(score.testsRequired).toBe(10);
    expect(score.missing).toEqual(["t9"]);
  });

  it("is null with nine of ten even when the nine are elite", () => {
    // The rule exists so nobody can skip the test they are worst at.
    const score = scoreBattery({ ...BASE, results: results(Array(9).fill(140)) });
    expect(score.composite).toBeNull();
    expect(score.tests.every((t) => t.percentile === 99)).toBe(true);
  });

  it("has no composite at all with zero results", () => {
    const score = scoreBattery({ ...BASE, results: [] });
    expect(score.composite).toBeNull();
    expect(score.missing).toHaveLength(10);
    expect(score.fitnessAge).toBeNull();
  });

  it("ignores results for tests outside this battery version", () => {
    const extra: RawResult[] = [
      ...results(Array(10).fill(100)),
      { testVariant: "not_in_battery", value: 999, recordedAt: "2026-06-01T10:00:00.000Z" },
    ];
    const score = scoreBattery({ ...BASE, results: extra });
    expect(score.tests).toHaveLength(10);
    expect(score.composite).toBe(50);
  });

  it("takes the newest result per test, so a correction supersedes", () => {
    const withCorrection: RawResult[] = [
      ...results(Array(10).fill(100)),
      { testVariant: "t0", value: 120, recordedAt: "2026-06-01T11:00:00.000Z" },
    ];
    const score = scoreBattery({ ...BASE, results: withCorrection });
    expect(score.tests.find((t) => t.testVariant === "t0")!.raw).toBe(120);
    expect(score.tests).toHaveLength(10);
  });

  it("scores age at the time of the test, not today", () => {
    // Born 1984-01-01. Tested in 2024 (age 40) vs 2044 (age 60).
    const young = scoreBattery({
      ...BASE,
      results: results(Array(10).fill(100), "2024-06-01T10:00:00.000Z"),
    });
    const old = scoreBattery({
      ...BASE,
      results: results(Array(10).fill(100), "2044-06-01T10:00:00.000Z"),
    });
    expect(young.composite).toBe(50);
    expect(old.composite).toBeGreaterThan(90);
  });

  it("flags the battery as provisional when any one file is", () => {
    const score = scoreBattery({ ...BASE, results: results(Array(10).fill(100)) });
    expect(score.anyProvisional).toBe(true);
    expect(score.tests.filter((t) => t.provisional)).toHaveLength(1);
  });

  it("carries the norms version through", () => {
    const score = scoreBattery({ ...BASE, results: results(Array(10).fill(100)) });
    expect(score.normsVersion).toBe("test");
  });

  it("floors the composite at 1 and caps it at 99, like its inputs", () => {
    const floor = scoreBattery({ ...BASE, results: results(Array(10).fill(-500)) });
    const cap = scoreBattery({ ...BASE, results: results(Array(10).fill(5000)) });
    expect(floor.composite).toBe(1);
    expect(cap.composite).toBe(99);
  });

  it("treats a missing norms file as a missing test rather than crashing", () => {
    const partialNorms = registryOf(...TEN.slice(0, 9));
    const score = scoreBattery({
      ...BASE,
      norms: partialNorms,
      results: results(Array(10).fill(100)),
    });
    expect(score.composite).toBeNull();
    expect(score.missing).toEqual(["t9"]);
  });
});

describe("runningAverage", () => {
  it("is explicitly not a composite - it works on partial data", () => {
    const partial = scoreBattery({ ...BASE, results: results(Array(4).fill(100)) });
    expect(partial.composite).toBeNull();
    expect(runningAverage(partial.tests)).toBe(50);
  });

  it("is null with nothing recorded", () => {
    expect(runningAverage([] as TestPercentile[])).toBeNull();
  });
});
