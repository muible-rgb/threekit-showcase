import { describe, expect, it } from "vitest";
import { ageAt, ageBand, cohortFor } from "./cohort";

describe("ageAt", () => {
  it("counts whole years", () => {
    expect(ageAt("1984-06-15", "2026-06-14")).toBe(41);
    expect(ageAt("1984-06-15", "2026-06-15")).toBe(42);
    expect(ageAt("1984-06-15", "2026-06-16")).toBe(42);
  });

  it("does not roll over early in an earlier month", () => {
    expect(ageAt("1984-12-31", "2026-01-01")).toBe(41);
  });

  it("handles a 29 February birthday", () => {
    expect(ageAt("2000-02-29", "2026-02-28")).toBe(25);
    expect(ageAt("2000-02-29", "2026-03-01")).toBe(26);
  });
});

describe("ageBand", () => {
  it("puts ages into 5-year bands", () => {
    expect(ageBand(40)).toEqual({ min: 40, max: 44 });
    expect(ageBand(44)).toEqual({ min: 40, max: 44 });
    expect(ageBand(45)).toEqual({ min: 45, max: 49 });
    expect(ageBand(30)).toEqual({ min: 30, max: 34 });
  });
});

describe("cohortFor", () => {
  it("resolves sex plus band at the time of the test", () => {
    expect(cohortFor("F", "1948-03-01", "2026-09-05")).toEqual({
      sex: "F",
      age: 78,
      ageBandMin: 75,
      ageBandMax: 79,
    });
  });
});
