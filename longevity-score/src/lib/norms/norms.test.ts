import { describe, expect, it } from "vitest";
import { NORMS_V1, normsRegistry } from "./registry";
import { validateNormsFile } from "./schema";
import { OPEN_V1_TESTS } from "@/lib/battery";
import { scoreBattery } from "@/lib/scoring/composite";
import { percentileFor } from "@/lib/scoring/percentile";

/**
 * These tests run against the REAL shipped norms files, not fixtures. They are
 * the guard on the acceptance criterion "every percentile in the UI traces back
 * to a norms file with a citation".
 */

describe("shipped norms files", () => {
  it("ships one file per test in the battery, and no orphans", () => {
    const slugs = normsRegistry.slugs().sort();
    const battery = OPEN_V1_TESTS.map((t) => t.slug).sort();
    expect(slugs).toEqual(battery);
  });

  it("validates structurally, with no errors", () => {
    const errors = NORMS_V1.flatMap((f) =>
      validateNormsFile(f, f.test_variant).filter((i) => i.level === "error"),
    );
    expect(errors).toEqual([]);
  });

  it("carries a citation on every file, provisional or not", () => {
    for (const f of NORMS_V1) {
      expect(f.source.citation.length).toBeGreaterThan(20);
    }
  });

  it("explains itself on every provisional file", () => {
    for (const f of NORMS_V1.filter((n) => n.source.provisional)) {
      expect(f.source.notes, `${f.test_variant} is provisional with no notes`).toBeTruthy();
      expect(f.source.notes!.length).toBeGreaterThan(80);
    }
  });

  it("agrees with the battery definition on unit, capacity and direction", () => {
    for (const t of OPEN_V1_TESTS) {
      const f = normsRegistry.get(t.slug)!;
      expect(f.unit, t.slug).toBe(t.unit);
      expect(f.capacity, t.slug).toBe(t.capacity);
      expect(f.direction, t.slug).toBe(t.direction);
    }
  });

  it("covers the whole 20-84 range for both sexes", () => {
    for (const f of NORMS_V1) {
      for (const sex of ["M", "F"] as const) {
        const bands = f.cohorts.filter((c) => c.sex === sex);
        expect(bands.length, `${f.test_variant} ${sex}`).toBe(13);
        expect(Math.min(...bands.map((c) => c.age_min))).toBe(20);
        expect(Math.max(...bands.map((c) => c.age_max))).toBe(84);
      }
    }
  });

  it("has exactly one lower-is-better test", () => {
    const lower = NORMS_V1.filter((f) => f.direction === "lower_better");
    expect(lower.map((f) => f.test_variant)).toEqual(["run_400m"]);
  });
});

describe("real norms produce sane percentiles", () => {
  it("puts an average 42-year-old man near the 50th on every test", () => {
    for (const f of NORMS_V1) {
      const cohort = f.cohorts.find(
        (c) => c.sex === "M" && c.age_min === 40,
      )!;
      const midValue = cohort.mean ?? cohort.percentiles!["50"];
      const p = percentileFor(f, midValue, "M", 42).percentile;
      expect(p, `${f.test_variant} at its own median`).toBeGreaterThan(45);
      expect(p, `${f.test_variant} at its own median`).toBeLessThan(55);
    }
  });

  it("moves in the right direction on every test", () => {
    for (const f of NORMS_V1) {
      const cohort = f.cohorts.find((c) => c.sex === "M" && c.age_min === 40)!;
      const mid = cohort.mean ?? cohort.percentiles!["50"];
      const better = f.direction === "higher_better" ? mid * 1.2 : mid * 0.8;
      const worse = f.direction === "higher_better" ? mid * 0.8 : mid * 1.2;
      expect(
        percentileFor(f, better, "M", 42).percentile,
        `${f.test_variant} should reward a better result`,
      ).toBeGreaterThan(percentileFor(f, worse, "M", 42).percentile);
    }
  });

  it("makes an identical raw result score higher at an older age", () => {
    for (const f of NORMS_V1) {
      const cohort = f.cohorts.find((c) => c.sex === "M" && c.age_min === 40)!;
      const mid = cohort.mean ?? cohort.percentiles!["50"];
      const at42 = percentileFor(f, mid, "M", 42).percentile;
      const at72 = percentileFor(f, mid, "M", 72).percentile;
      expect(at72, `${f.test_variant}`).toBeGreaterThan(at42);
    }
  });
});

describe("the whole open-v1 battery, end to end", () => {
  const battery = OPEN_V1_TESTS.map((t) => t.slug);

  function medianResults(sex: "M" | "F", ageBandMin: number) {
    return OPEN_V1_TESTS.map((t) => {
      const f = normsRegistry.get(t.slug)!;
      const c = f.cohorts.find((x) => x.sex === sex && x.age_min === ageBandMin)!;
      return {
        testVariant: t.slug,
        value: c.mean ?? c.percentiles!["50"],
        recordedAt: "2026-06-01T10:00:00.000Z",
      };
    });
  }

  it("scores a dead-average 42-year-old man at about 50", () => {
    const score = scoreBattery({
      sex: "M",
      birthDate: "1984-01-01",
      batteryTests: battery,
      results: medianResults("M", 40),
      norms: normsRegistry,
    });
    expect(score.composite).not.toBeNull();
    expect(score.composite!).toBeGreaterThan(45);
    expect(score.composite!).toBeLessThan(55);
    expect(score.band).toBe("Solid");
    expect(score.tests).toHaveLength(10);
  });

  it("gives a dead-average person a fitness age near their own age", () => {
    const score = scoreBattery({
      sex: "M",
      birthDate: "1984-01-01",
      batteryTests: battery,
      results: medianResults("M", 40),
      norms: normsRegistry,
      completedAt: "2026-06-01T10:00:00.000Z",
    });
    expect(score.fitnessAge).not.toBeNull();
    expect(Math.abs(score.fitnessAge!.years - 42)).toBeLessThan(4);
    expect(score.fitnessAge!.approx).toBe(false);
  });

  it("lets a 78-year-old woman outscore a 32-year-old man - the whole point", () => {
    // She posts her own cohort's 90th percentile. He posts his cohort's 25th.
    const her = OPEN_V1_TESTS.map((t) => {
      const f = normsRegistry.get(t.slug)!;
      const c = f.cohorts.find((x) => x.sex === "F" && x.age_min === 75)!;
      const value = c.mean !== undefined
        ? c.mean + (f.direction === "higher_better" ? 1.28 * c.sd! : -1.28 * c.sd!)
        : c.percentiles!["90"];
      return { testVariant: t.slug, value, recordedAt: "2026-06-01T10:00:00.000Z" };
    });

    const him = OPEN_V1_TESTS.map((t) => {
      const f = normsRegistry.get(t.slug)!;
      const c = f.cohorts.find((x) => x.sex === "M" && x.age_min === 30)!;
      const value = c.mean !== undefined
        ? c.mean + (f.direction === "higher_better" ? -0.67 * c.sd! : 0.67 * c.sd!)
        : c.percentiles!["25"];
      return { testVariant: t.slug, value, recordedAt: "2026-06-01T10:00:00.000Z" };
    });

    const hers = scoreBattery({
      sex: "F",
      birthDate: "1948-01-01",
      batteryTests: battery,
      results: her,
      norms: normsRegistry,
    });
    const his = scoreBattery({
      sex: "M",
      birthDate: "1994-01-01",
      batteryTests: battery,
      results: him,
      norms: normsRegistry,
    });

    expect(hers.composite!).toBeGreaterThan(his.composite!);
    expect(hers.composite!).toBeGreaterThan(80);
    expect(his.composite!).toBeLessThan(40);
  });

  it("refuses a composite when the Cooper run is missing", () => {
    const nine = medianResults("M", 40).filter(
      (r) => r.testVariant !== "cooper_12min_run",
    );
    const score = scoreBattery({
      sex: "M",
      birthDate: "1984-01-01",
      batteryTests: battery,
      results: nine,
      norms: normsRegistry,
    });
    expect(score.composite).toBeNull();
    expect(score.testsCompleted).toBe(9);
    expect(score.missing).toEqual(["cooper_12min_run"]);
  });
});
