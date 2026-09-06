import { describe, expect, it } from "vitest";
import {
  COMPOSITE_SD,
  bandFor,
  populationPercentile,
  runningAverage,
  scoreBattery,
} from "./composite";
import { eightTestFixture } from "./__fixtures__/lookup";
import type { RawResult, TestPercentile } from "./types";

/**
 * Every event in the fixture has median 100 at 18 falling one unit a year and
 * a P1-P99 half-span of 20. Born 1984-01-01, tested 2026-06-01: age 42, median
 * 76, so raw 76 is exactly P50 and raw 86 is exactly P75.
 */
const { lookup, bindings } = eightTestFixture();

function results(values: number[], at = "2026-06-01T10:00:00.000Z"): RawResult[] {
  return values.map((value, i) => ({ testVariant: `t${i}`, value, recordedAt: at }));
}

const BASE = { sex: "M" as const, birthDate: "1984-01-01", tests: bindings, lookup };
const eight = (v: number) => Array(8).fill(v);

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
    expect(bandFor(0)).toBe("At risk");
  });

  it("puts one tenth below each boundary in the band beneath", () => {
    expect(bandFor(89.9)).toBe("Strong");
    expect(bandFor(74.9)).toBe("Solid");
    expect(bandFor(49.9)).toBe("Below average");
    expect(bandFor(24.9)).toBe("At risk");
  });
});

describe("composite", () => {
  it("is the unweighted mean of eight percentiles", () => {
    const score = scoreBattery({ ...BASE, results: results(eight(76)) });
    expect(score.composite).toBe(50);
    expect(score.band).toBe("Solid");
    expect(score.testsCompleted).toBe(8);
  });

  it("reports one decimal, not a rounded integer", () => {
    // Seven at P50 and one at P75: (350 + 75) / 8 = 53.125 -> 53.1.
    const score = scoreBattery({ ...BASE, results: results([86, 76, 76, 76, 76, 76, 76, 76]) });
    expect(score.composite).toBe(53.1);
  });

  it("is null when a single test is missing", () => {
    const score = scoreBattery({ ...BASE, results: results(Array(7).fill(76)) });
    expect(score.composite).toBeNull();
    expect(score.band).toBeNull();
    expect(score.testsCompleted).toBe(7);
    expect(score.testsRequired).toBe(8);
    expect(score.missing).toEqual(["t7"]);
  });

  it("is null with seven of eight even when the seven are elite", () => {
    // The rule exists so nobody can skip the test they are worst at.
    const score = scoreBattery({ ...BASE, results: results(Array(7).fill(200)) });
    expect(score.composite).toBeNull();
    expect(score.tests.every((t) => t.percentile === 99.5)).toBe(true);
  });

  it("has no composite at all with zero results", () => {
    const score = scoreBattery({ ...BASE, results: [] });
    expect(score.composite).toBeNull();
    expect(score.missing).toHaveLength(8);
    expect(score.fitnessAge).toBeNull();
  });

  it("ignores results for tests outside this battery", () => {
    const extra: RawResult[] = [
      ...results(eight(76)),
      { testVariant: "not_in_battery", value: 999, recordedAt: "2026-06-01T10:00:00.000Z" },
    ];
    const score = scoreBattery({ ...BASE, results: extra });
    expect(score.tests).toHaveLength(8);
    expect(score.composite).toBe(50);
  });

  it("takes the newest result per test, so a correction supersedes", () => {
    const withCorrection: RawResult[] = [
      ...results(eight(76)),
      { testVariant: "t0", value: 86, recordedAt: "2026-06-01T11:00:00.000Z" },
    ];
    const score = scoreBattery({ ...BASE, results: withCorrection });
    expect(score.tests.find((t) => t.testVariant === "t0")!.raw).toBe(86);
    expect(score.tests.find((t) => t.testVariant === "t0")!.percentile).toBe(75);
    expect(score.tests).toHaveLength(8);
  });

  it("scores age at the time of the test, not today", () => {
    // Born 1984-01-01. Tested in 2024 (age 40, median 78) vs 2044 (age 60, median 58).
    const young = scoreBattery({ ...BASE, results: results(eight(78), "2024-06-01T10:00:00.000Z") });
    const old = scoreBattery({ ...BASE, results: results(eight(78), "2044-06-01T10:00:00.000Z") });
    expect(young.composite).toBe(50);
    expect(old.composite).toBeGreaterThan(90);
  });

  it("converts the app's unit into the table's before scoring", () => {
    // Stored in inches, benchmarked in centimetres: 30 in * 2.54 = 76.2 cm.
    const inches = bindings.map((b) => (b.slug === "t0" ? { ...b, factor: 2.54 } : b));
    const score = scoreBattery({
      ...BASE,
      tests: inches,
      results: results([30, 76, 76, 76, 76, 76, 76, 76]),
    });
    const t0 = score.tests.find((t) => t.testVariant === "t0")!;
    expect(t0.raw).toBe(30); // the raw stays in the unit it was entered in
    expect(t0.percentile).toBe(50.5); // 76.2 is a fifth of the way from P50 to P51
  });

  it("flags the battery as provisional when any one event is Grade D", () => {
    const score = scoreBattery({ ...BASE, results: results(eight(76)) });
    expect(score.anyProvisional).toBe(true);
    expect(score.tests.filter((t) => t.provisional).map((t) => t.testVariant)).toEqual(["t7"]);
    expect(score.tests.find((t) => t.testVariant === "t7")!.evidenceGrade).toBe("D");
  });

  it("carries the benchmark version through", () => {
    const score = scoreBattery({ ...BASE, results: results(eight(76)) });
    expect(score.benchmarkVersion).toBe("test");
  });

  it("scores past the anchors as 0.5 and 99.5 rather than inventing precision", () => {
    const floor = scoreBattery({ ...BASE, results: results(eight(-500)) });
    const cap = scoreBattery({ ...BASE, results: results(eight(5000)) });
    expect(floor.composite).toBe(0.5);
    expect(cap.composite).toBe(99.5);
  });

  it("refuses a binding to an event the table does not have", () => {
    const bad = bindings.map((b) => (b.slug === "t7" ? { ...b, event: "nope" } : b));
    expect(() => scoreBattery({ ...BASE, tests: bad, results: results(eight(76)) })).toThrow(
      /unknown benchmark event: nope/,
    );
  });
});

describe("populationPercentile", () => {
  it("models the mean of eight correlated percentiles with SD near 20", () => {
    expect(COMPOSITE_SD).toBeCloseTo(19.9, 1);
  });

  it("puts an average score at the median", () => {
    expect(populationPercentile(50)).toBe(50);
  });

  it("is much tighter than the score itself - 90 is the top 2%, not the top 10%", () => {
    expect(populationPercentile(70)).toBe(84.3);
    expect(populationPercentile(80)).toBe(93.4);
    expect(populationPercentile(90)).toBe(97.8);
    expect(populationPercentile(30)).toBe(15.7);
  });

  it("never reaches 0 or 100 - a perfect card is z = 2.5, the 99.4th", () => {
    expect(populationPercentile(100)).toBe(99.4);
    expect(populationPercentile(0)).toBe(0.6);
  });

  it("is null without a composite", () => {
    expect(populationPercentile(null)).toBeNull();
    const partial = scoreBattery({ ...BASE, results: results(Array(4).fill(76)) });
    expect(partial.populationPercentile).toBeNull();
  });

  it("rides along on the battery score", () => {
    const score = scoreBattery({ ...BASE, results: results(eight(76)) });
    expect(score.populationPercentile).toBe(50);
  });
});

describe("runningAverage", () => {
  it("is explicitly not a composite - it works on partial data", () => {
    const partial = scoreBattery({ ...BASE, results: results(Array(4).fill(76)) });
    expect(partial.composite).toBeNull();
    expect(runningAverage(partial.tests)).toBe(50);
  });

  it("is null with nothing recorded", () => {
    expect(runningAverage([] as TestPercentile[])).toBeNull();
  });
});
