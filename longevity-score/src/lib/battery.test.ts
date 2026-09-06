import { describe, expect, it } from "vitest";
import {
  BATTERY_TESTS,
  BATTERY_TEST_COUNT,
  CARRY_LOAD_LB,
  CARRY_LOAD_TOLERANCE,
  carryLoadDrift,
  testBySlug,
} from "./battery";
import { normsRegistry } from "./norms/registry";
import { percentileFor } from "./scoring/percentile";
import { formatRaw, formatRawDelta } from "./utils";

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

  it("has a norms file for every test, matching unit and direction", () => {
    for (const t of BATTERY_TESTS) {
      const f = normsRegistry.get(t.slug);
      expect(f, `no norms for ${t.slug}`).toBeDefined();
      expect(f!.unit, t.slug).toBe(t.unit);
      expect(f!.direction, t.slug).toBe(t.direction);
      expect(f!.capacity, t.slug).toBe(t.capacity);
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
      const f = normsRegistry.get(t.slug)!;
      for (const v of [t.min, t.min + t.step, t.max - t.step, t.max]) {
        const p = percentileFor(f, v, "F", 42).percentile;
        expect(p, `${t.slug} at ${v}`).toBeGreaterThanOrEqual(1);
        expect(p, `${t.slug} at ${v}`).toBeLessThanOrEqual(99);
      }
    }
  });

  it("makes the better end of each range score higher", () => {
    for (const t of BATTERY_TESTS) {
      const f = normsRegistry.get(t.slug)!;
      const atMin = percentileFor(f, t.min, "M", 42).percentile;
      const atMax = percentileFor(f, t.max, "M", 42).percentile;
      if (t.direction === "higher_better") {
        expect(atMax, t.slug).toBeGreaterThan(atMin);
      } else {
        expect(atMin, t.slug).toBeGreaterThan(atMax);
      }
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

  it("prescribes one load for everyone, whatever they weigh", () => {
    expect(CARRY_LOAD_LB).toBe(50);
    expect(carryLoadDrift(CARRY_LOAD_LB)).toBe(0);
    // A 53 lb kettlebell is the nearest thing most racks have. Still on protocol.
    expect(Math.abs(carryLoadDrift(53)!)).toBeLessThan(CARRY_LOAD_TOLERANCE);
  });

  it("flags a load that is not the prescribed one", () => {
    const light = carryLoadDrift(25)!;
    const heavy = carryLoadDrift(75)!;
    expect(light).toBe(-0.5);
    expect(heavy).toBe(0.5);
    expect(Math.abs(light)).toBeGreaterThan(CARRY_LOAD_TOLERANCE);
    expect(Math.abs(heavy)).toBeGreaterThan(CARRY_LOAD_TOLERANCE);
  });

  it("says it does not know rather than guessing", () => {
    // No load recorded is a different answer from "on protocol".
    expect(carryLoadDrift(null)).toBeNull();
    expect(carryLoadDrift(undefined)).toBeNull();
    expect(carryLoadDrift(0)).toBeNull();
  });
});

describe("pull-ups accept zero", () => {
  it("treats zero as a real result, not a missing one", () => {
    const pullUps = testBySlug("pull_ups")!;
    expect(pullUps.min).toBe(0);
    const p = percentileFor(normsRegistry.get("pull_ups")!, 0, "F", 42).percentile;
    expect(p).toBeGreaterThanOrEqual(1);
    expect(p).toBeLessThan(50);
  });
});

describe("balance is capped at the protocol ceiling", () => {
  it("scores everyone who reaches 60 seconds identically", () => {
    const f = normsRegistry.get("balance_eyes_closed")!;
    expect(percentileFor(f, 60, "M", 42).percentile).toBe(
      percentileFor(f, 120, "M", 42).percentile,
    );
  });
});
