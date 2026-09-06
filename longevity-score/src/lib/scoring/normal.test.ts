import { describe, expect, it } from "vitest";
import { normalCdf } from "./normal";

describe("normalCdf", () => {
  it("is one half at zero", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 8);
  });

  it("matches the textbook values", () => {
    expect(normalCdf(1)).toBeCloseTo(0.8413447, 6);
    expect(normalCdf(-1)).toBeCloseTo(0.1586553, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
    expect(normalCdf(2.5)).toBeCloseTo(0.9937903, 6);
  });

  it("is symmetric", () => {
    for (const z of [0.3, 1.2, 2.7]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 8);
    }
  });

  it("handles the ends", () => {
    expect(normalCdf(Infinity)).toBe(1);
    expect(normalCdf(-Infinity)).toBe(0);
    expect(normalCdf(10)).toBeCloseTo(1, 8);
  });
});
