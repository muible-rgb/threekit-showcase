import { describe, expect, it } from "vitest";
import { percentileFor, percentileInCohort, scoreTest } from "./percentile";
import {
  cappedHigher,
  cutPointsHigher,
  cutPointsLower,
  meanSdHigher,
  meanSdLower,
} from "./__fixtures__/norms";

describe("mean/SD norms, higher is better", () => {
  it("puts the cohort mean at the 50th percentile", () => {
    expect(percentileFor(meanSdHigher, 46, "M", 42).percentile).toBe(50);
  });

  it("puts one SD above the mean at ~84", () => {
    expect(percentileFor(meanSdHigher, 56, "M", 42).percentile).toBeCloseTo(84.1, 1);
  });

  it("puts one SD below the mean at ~16", () => {
    expect(percentileFor(meanSdHigher, 36, "M", 42).percentile).toBeCloseTo(15.9, 1);
  });

  it("reports the method it used", () => {
    expect(percentileFor(meanSdHigher, 46, "M", 42).method).toBe("mean_sd");
  });

  it("is smooth - every extra kg moves the number", () => {
    const a = percentileFor(meanSdHigher, 46, "M", 42).percentile;
    const b = percentileFor(meanSdHigher, 47, "M", 42).percentile;
    const c = percentileFor(meanSdHigher, 48, "M", 42).percentile;
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("scores against the right sex", () => {
    // 30 kg is average for a woman 40-44 and poor for a man of the same age.
    expect(percentileFor(meanSdHigher, 30, "F", 42).percentile).toBe(50);
    expect(percentileFor(meanSdHigher, 30, "M", 42).percentile).toBeLessThan(10);
  });
});

describe("mean/SD norms, lower is better", () => {
  it("puts the mean at the 50th percentile", () => {
    expect(percentileFor(meanSdLower, 80, "M", 42).percentile).toBe(50);
  });

  it("rewards a faster time", () => {
    expect(percentileFor(meanSdLower, 70, "M", 42).percentile).toBeCloseTo(84.1, 1);
  });

  it("punishes a slower time", () => {
    expect(percentileFor(meanSdLower, 90, "M", 42).percentile).toBeCloseTo(15.9, 1);
  });

  it("is monotone decreasing in the raw value", () => {
    const times = [70, 75, 80, 85, 90];
    const pcts = times.map((t) => percentileFor(meanSdLower, t, "M", 42).percentile);
    for (let i = 1; i < pcts.length; i++) {
      expect(pcts[i]).toBeLessThan(pcts[i - 1]);
    }
  });
});

describe("cut-point norms, higher is better", () => {
  it("lands exactly on a published cut-point", () => {
    expect(percentileFor(cutPointsHigher, 20, "M", 42).percentile).toBe(50);
    expect(percentileFor(cutPointsHigher, 30, "M", 42).percentile).toBe(75);
    expect(percentileFor(cutPointsHigher, 10, "M", 42).percentile).toBe(10);
  });

  it("interpolates linearly between cut-points", () => {
    // Halfway between the 50th (20 reps) and 75th (30 reps).
    expect(percentileFor(cutPointsHigher, 25, "M", 42).percentile).toBe(62.5);
    // Quarter of the way from the 25th (15) to the 50th (20).
    expect(percentileFor(cutPointsHigher, 16.25, "M", 42).percentile).toBe(31.3);
  });

  it("reports the method it used", () => {
    expect(percentileFor(cutPointsHigher, 25, "M", 42).method).toBe("cut_points");
  });

  it("extrapolates above the top cut-point instead of flattening", () => {
    const at90 = percentileFor(cutPointsHigher, 40, "M", 42);
    const above = percentileFor(cutPointsHigher, 45, "M", 42);
    expect(at90.percentile).toBe(90);
    expect(at90.extrapolated).toBe(false);
    expect(above.percentile).toBeGreaterThan(90);
    expect(above.extrapolated).toBe(true);
  });

  it("extrapolates below the bottom cut-point", () => {
    const below = percentileFor(cutPointsHigher, 5, "M", 42);
    expect(below.percentile).toBeLessThan(10);
    expect(below.extrapolated).toBe(true);
  });

  it("keeps ordering intact at the top of the board", () => {
    // The reason we extrapolate: two elite results must not both read 90.0.
    const a = percentileFor(cutPointsHigher, 45, "M", 42).percentile;
    const b = percentileFor(cutPointsHigher, 55, "M", 42).percentile;
    expect(b).toBeGreaterThan(a);
  });
});

describe("cut-point norms, lower is better", () => {
  it("lands on published cut-points with the direction reversed", () => {
    expect(percentileFor(cutPointsLower, 90, "M", 42).percentile).toBe(50);
    expect(percentileFor(cutPointsLower, 70, "M", 42).percentile).toBe(90);
    expect(percentileFor(cutPointsLower, 110, "M", 42).percentile).toBe(10);
  });

  it("interpolates in the right direction", () => {
    expect(percentileFor(cutPointsLower, 85, "M", 42).percentile).toBe(62.5);
  });

  it("extrapolates past a very fast time", () => {
    const r = percentileFor(cutPointsLower, 60, "M", 42);
    expect(r.percentile).toBe(99);
    expect(r.extrapolated).toBe(true);
  });
});

describe("floor and cap", () => {
  it("never returns 100", () => {
    expect(percentileFor(meanSdHigher, 500, "M", 42).percentile).toBe(99);
  });

  it("never returns 0", () => {
    expect(percentileFor(meanSdHigher, 0, "M", 42).percentile).toBe(1);
  });

  it("never returns 0 or 100 on a lower-is-better test either", () => {
    expect(percentileFor(meanSdLower, 1, "M", 42).percentile).toBe(99);
    expect(percentileFor(meanSdLower, 900, "M", 42).percentile).toBe(1);
  });

  it("clamps on the cut-point path too", () => {
    expect(percentileFor(cutPointsHigher, 10000, "M", 42).percentile).toBe(99);
    expect(percentileFor(cutPointsHigher, -50, "M", 42).percentile).toBe(1);
  });
});

describe("rounding", () => {
  it("stores exactly one decimal", () => {
    for (const v of [41, 43.7, 44.2, 47.9, 52.3]) {
      const p = percentileFor(meanSdHigher, v, "M", 42).percentile;
      expect(p * 10).toBe(Math.round(p * 10));
    }
  });
});

describe("protocol caps", () => {
  it("treats everyone at the cap identically", () => {
    const at = percentileFor(cappedHigher, 60, "M", 42).percentile;
    const over = percentileFor(cappedHigher, 120, "M", 42).percentile;
    expect(over).toBe(at);
  });

  it("still resolves below the cap", () => {
    expect(percentileFor(cappedHigher, 30, "M", 42).percentile).toBeGreaterThan(
      percentileFor(cappedHigher, 20, "M", 42).percentile,
    );
  });
});

describe("cohort clamping", () => {
  it("flags a person younger than the norms cover", () => {
    expect(percentileFor(meanSdHigher, 46, "M", 15).cohortClamped).toBe(true);
  });

  it("does not flag a person inside the covered range", () => {
    expect(percentileFor(meanSdHigher, 46, "M", 42).cohortClamped).toBe(false);
  });
});

describe("malformed norms", () => {
  it("throws rather than guessing when a cohort has neither format", () => {
    expect(() =>
      percentileInCohort(10, { sex: "M", age_min: 40, age_max: 44 }, "higher_better"),
    ).toThrow(/malformed/);
  });

  it("does not produce NaN when SD is zero", () => {
    const p = percentileInCohort(
      50,
      { sex: "M", age_min: 40, age_max: 44, mean: 50, sd: 0 },
      "higher_better",
    );
    expect(p.percentile).toBe(50);
    expect(
      percentileInCohort(
        60,
        { sex: "M", age_min: 40, age_max: 44, mean: 50, sd: 0 },
        "higher_better",
      ).percentile,
    ).toBe(99);
  });

  it("throws when the file has no cohorts for that sex", () => {
    expect(() => percentileFor({ ...meanSdHigher, cohorts: [] }, 46, "M", 42)).toThrow(
      /no cohorts/,
    );
  });
});

describe("scoreTest", () => {
  it("carries the provisional flag through from the norms file", () => {
    expect(scoreTest(meanSdHigher, 46, "M", 42).provisional).toBe(false);
    expect(scoreTest(meanSdLower, 80, "M", 42).provisional).toBe(true);
  });

  it("carries capacity and unit so the UI never has to look them up", () => {
    const t = scoreTest(meanSdHigher, 46, "M", 42);
    expect(t.capacity).toBe("grip");
    expect(t.unit).toBe("kg");
    expect(t.raw).toBe(46);
  });
});

describe("the core promise: scoring is cohort-relative", () => {
  it("lets a 78-year-old woman outscore a 30-year-old man", () => {
    // Deliberately literal: this is the product's central claim, so it gets a
    // test rather than a comment.
    const norms = {
      ...meanSdHigher,
      cohorts: [
        { sex: "F" as const, age_min: 75, age_max: 79, mean: 20, sd: 4 },
        { sex: "M" as const, age_min: 30, age_max: 34, mean: 50, sd: 10 },
      ],
    };
    const her = percentileFor(norms, 28, "F", 78).percentile; // 2 SD above
    const him = percentileFor(norms, 45, "M", 32).percentile; // half SD below
    expect(her).toBeGreaterThan(him);
    expect(her).toBeGreaterThan(90);
    expect(him).toBeLessThan(50);
  });
});

describe("non-finite input", () => {
  it("names the test rather than failing inside the interpolator", () => {
    // An empty input field or a missing cut-point used to surface as
    // "cut-point interpolation fell through", which says nothing useful.
    expect(() => percentileFor(cutPointsHigher, NaN, "M", 42)).toThrow(
      /fixture_cut_points_higher: raw value must be a finite number/,
    );
    expect(() => percentileFor(meanSdHigher, undefined as unknown as number, "M", 42))
      .toThrow(/must be a finite number/);
  });
});
