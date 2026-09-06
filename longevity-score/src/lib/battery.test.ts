import { describe, expect, it } from "vitest";
import {
  BATTERY_TESTS,
  BATTERY_TEST_COUNT,
  CARRY_LOAD_LB,
  CARRY_LOAD_TOLERANCE,
  carryLoadDrift,
  testBySlug,
} from "./battery";
import { scorer } from "./benchmarks/registry";
import { formatRaw, formatRawDelta, formatResult } from "./utils";

/** A stored raw value, in the table's unit, scored for a 42-year-old. */
const score = (t: (typeof BATTERY_TESTS)[number], v: number, sex: "M" | "F" = "F") =>
  scorer.scoreEvent(t.benchmark.event, sex, 42, v * t.benchmark.factor).score;

/** The unit the app stores against the unit the table speaks. */
const UNIT_FAMILY: Record<string, string> = {
  s: "seconds",
  reps: "reps",
  in: "cm",
  ft: "meters",
  points: "score_0_10",
};

/**
 * Input plumbing.
 *
 * Every one of these guards a specific way a number can arrive wrong: a bound
 * that lets an impossible value through, a step that cannot express the
 * result, a unit the display does not know how to render. They are cheap and
 * they catch the class of bug that silently produces a confident wrong
 * percentile.
 */

describe("battery definition", () => {
  it("is eight tests, one per capacity", () => {
    expect(BATTERY_TESTS).toHaveLength(8);
    expect(BATTERY_TEST_COUNT).toBe(8);
    const capacities = new Set(BATTERY_TESTS.map((t) => t.capacity));
    expect(capacities.size).toBe(8);
  });

  it("binds every test to a benchmark event with a matching direction and unit", () => {
    for (const t of BATTERY_TESTS) {
      const ev = scorer.event(t.benchmark.event);
      expect(ev, `no benchmark event for ${t.slug}`).toBeDefined();
      expect(ev!.lower_better, t.slug).toBe(t.direction === "lower_better");
      expect(ev!.unit, t.slug).toBe(UNIT_FAMILY[t.unit]);
      // Same-unit tests convert by 1; the two imperial lengths convert to metric.
      if (t.unit === "in") expect(t.benchmark.factor).toBe(2.54);
      else if (t.unit === "ft") expect(t.benchmark.factor).toBe(0.3048);
      else expect(t.benchmark.factor, t.slug).toBe(1);
    }
  });

  it("gives every test a sane input range", () => {
    for (const t of BATTERY_TESTS) {
      expect(t.min, t.slug).toBeLessThan(t.max);
      expect(t.step, t.slug).toBeGreaterThan(0);
      // A step coarser than the range is a typo, not a design choice.
      expect(t.step, t.slug).toBeLessThan(t.max - t.min);
    }
  });

  it("can express a real result at the step size it declares", () => {
    // Agility is hundredths, balance is halves, reps are whole. If the step
    // cannot represent a plausible result, people round and the score drifts.
    expect(testBySlug("agility_5_10_5")!.step).toBeLessThanOrEqual(0.01);
    expect(testBySlug("balance_eyes_closed")!.step).toBeLessThanOrEqual(0.5);
    expect(testBySlug("pull_ups")!.step).toBe(1);
    expect(testBySlug("sit_to_rise")!.step).toBe(0.5);
  });

  it("uses a unit the display knows how to render", () => {
    const known = ["s", "reps", "in", "ft", "points", "lb"];
    for (const t of BATTERY_TESTS) {
      expect(known, t.slug).toContain(t.unit);
      // A unit that falls through formatRaw shows a bare number and its raw
      // unit code, which looks broken.
      expect(formatRaw(t.min + t.step, t.unit)).not.toMatch(/undefined|NaN/);
      expect(formatRawDelta(t.step, t.unit)).not.toMatch(/undefined|NaN/);
    }
  });

  it("only the mile and the agility shuttle are lower-is-better", () => {
    const lower = BATTERY_TESTS.filter((t) => t.direction === "lower_better").map(
      (t) => t.slug,
    );
    expect(lower.sort()).toEqual(["agility_5_10_5", "mile_run"]);
  });

  it("accepts a plausible result at both ends of every range", () => {
    // The engine must not throw anywhere inside a range the UI allows.
    for (const t of BATTERY_TESTS) {
      for (const v of [t.min, t.min + t.step, t.max - t.step, t.max]) {
        const p = score(t, v);
        expect(p, `${t.slug} at ${v}`).toBeGreaterThanOrEqual(0);
        expect(p, `${t.slug} at ${v}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("makes the better end of each range score higher", () => {
    for (const t of BATTERY_TESTS) {
      const atMin = score(t, t.min, "M");
      const atMax = score(t, t.max, "M");
      if (t.direction === "higher_better") {
        expect(atMax, t.slug).toBeGreaterThan(atMin);
      } else {
        expect(atMin, t.slug).toBeGreaterThan(atMax);
      }
    }
  });

  it("lets the mile and the shuttle record a did-not-finish, at the top of their range", () => {
    // DNF is a real result that shares the floor with everyone who could not
    // finish. It has to be enterable, so it sits inside the allowed range.
    const mile = testBySlug("mile_run")!;
    const agility = testBySlug("agility_5_10_5")!;
    expect(mile.dnfValue).toBe(1800);
    expect(mile.max).toBe(mile.dnfValue);
    expect(agility.dnfValue).toBe(30);
    expect(agility.max).toBe(agility.dnfValue);
    expect(formatResult(mile, 1800)).toBe("DNF");
    expect(formatResult(agility, 30)).toBe("DNF");
    expect(formatResult(agility, 5.62)).toBe("5.62s");
    // A DNF scores in the low tail: never above the slowest finishing time,
    // and never as missing. At 42 nobody between P1 and P99 fails to finish,
    // so the tied group is empty and a DNF reads 0.0; at 85 it reads 5.1.
    expect(score(mile, 1800, "M")).toBeLessThanOrEqual(score(mile, 1799, "M"));
    expect(score(mile, 1800, "M")).toBeLessThan(10);
    expect(scorer.scoreEvent("mile_run", "M", 85, 1800).score).toBe(5.1);
    for (const t of BATTERY_TESTS) {
      if (t.dnfValue === undefined) expect(formatResult(t, t.max)).not.toBe("DNF");
    }
  });
});

describe("the mile is entered as minutes and seconds", () => {
  const mile = testBySlug("mile_run")!;

  it("stores seconds and shows a clock", () => {
    // 7:42 typed in is 462 stored, and 7:42 shown again.
    const stored = 7 * 60 + 42;
    expect(formatRaw(stored, mile.unit)).toBe("7:42");
    expect(stored).toBeGreaterThanOrEqual(mile.min);
    expect(stored).toBeLessThanOrEqual(mile.max);
  });

  it("brackets a plausible mile at both ends", () => {
    expect(mile.min).toBe(240); // 4:00, a very fast mile
    expect(mile.max).toBe(1800); // 30:00, a walk
  });
});

describe("the carry records what you held as well as how far", () => {
  const carry = testBySlug("farmer_carry")!;

  it("declares a second field", () => {
    expect(carry.input).toBe("load_distance");
    expect(carry.secondary).toBeDefined();
    expect(carry.secondary!.unit).toBe("lb");
  });

  it("prescribes the load by sex, not by what you weigh", () => {
    expect(CARRY_LOAD_LB.M).toBe(50);
    expect(CARRY_LOAD_LB.F).toBe(35);
    expect(carryLoadDrift(50, "M")).toBe(0);
    expect(carryLoadDrift(35, "F")).toBe(0);
    // A 53 lb kettlebell is the nearest thing most racks have. Still on protocol.
    expect(Math.abs(carryLoadDrift(53, "M")!)).toBeLessThan(CARRY_LOAD_TOLERANCE);
    // As is a pair of 35s read off a 40 lb rack step for a woman.
    expect(Math.abs(carryLoadDrift(40, "F")!)).toBeLessThan(CARRY_LOAD_TOLERANCE);
  });

  it("measures drift against your own prescription", () => {
    // 50 lb is on protocol for a man and half again too heavy for a woman.
    expect(carryLoadDrift(50, "M")).toBe(0);
    expect(carryLoadDrift(50, "F")).toBeCloseTo(0.4286, 4);
    expect(Math.abs(carryLoadDrift(50, "F")!)).toBeGreaterThan(CARRY_LOAD_TOLERANCE);
  });

  it("flags a load that is not the prescribed one", () => {
    const light = carryLoadDrift(25, "M")!;
    const heavy = carryLoadDrift(75, "M")!;
    expect(light).toBe(-0.5);
    expect(heavy).toBe(0.5);
    expect(Math.abs(light)).toBeGreaterThan(CARRY_LOAD_TOLERANCE);
    expect(Math.abs(heavy)).toBeGreaterThan(CARRY_LOAD_TOLERANCE);
  });

  it("says it does not know rather than guessing", () => {
    // No load recorded is a different answer from "on protocol".
    expect(carryLoadDrift(null, "M")).toBeNull();
    expect(carryLoadDrift(undefined, "F")).toBeNull();
    expect(carryLoadDrift(0, "M")).toBeNull();
  });
});

describe("pull-ups accept zero", () => {
  it("treats zero as a real result, not a missing one", () => {
    const pullUps = testBySlug("pull_ups")!;
    expect(pullUps.min).toBe(0);
    // Most women at 42 score zero, so zero is scored mid-rank in that group:
    // well above 0, and below the first rep.
    const zero = score(pullUps, 0);
    expect(zero).toBeGreaterThan(20);
    expect(zero).toBeLessThan(50);
    expect(score(pullUps, 1)).toBeGreaterThan(zero);
  });
});

describe("balance is capped at the protocol ceiling", () => {
  it("scores everyone who reaches 60 seconds identically", () => {
    const balance = testBySlug("balance_eyes_closed")!;
    expect(score(balance, 60, "M")).toBe(score(balance, 120, "M"));
  });
});
