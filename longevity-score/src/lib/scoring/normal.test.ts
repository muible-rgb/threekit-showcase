import { describe, expect, it } from "vitest";
import { normalCdf, normalInv } from "./normal";

describe("normalCdf", () => {
  it("is 0.5 at the mean", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 8);
  });

  it("matches published z-table values", () => {
    expect(normalCdf(1)).toBeCloseTo(0.8413447, 6);
    expect(normalCdf(-1)).toBeCloseTo(0.1586553, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
    expect(normalCdf(-1.96)).toBeCloseTo(0.0249979, 6);
    expect(normalCdf(2.5758)).toBeCloseTo(0.995, 5);
  });

  it("is symmetric", () => {
    for (const z of [0.25, 0.5, 1, 1.5, 2, 3]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 9);
    }
  });

  it("saturates without going out of bounds", () => {
    expect(normalCdf(10)).toBeLessThanOrEqual(1);
    expect(normalCdf(-10)).toBeGreaterThanOrEqual(0);
  });
});

describe("normalInv", () => {
  it("round-trips through the CDF", () => {
    for (const p of [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 0.999]) {
      expect(normalCdf(normalInv(p))).toBeCloseTo(p, 8);
    }
  });

  it("matches published quantiles", () => {
    expect(normalInv(0.5)).toBeCloseTo(0, 8);
    expect(normalInv(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalInv(0.025)).toBeCloseTo(-1.959964, 5);
  });

  it("handles the rails", () => {
    expect(normalInv(0)).toBe(-Infinity);
    expect(normalInv(1)).toBe(Infinity);
  });
});
