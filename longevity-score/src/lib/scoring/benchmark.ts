import type {
  BenchmarkEvent,
  BenchmarkLookup,
  ContinuousBenchmarkEvent,
  Derivation,
  DiscreteBenchmarkEvent,
  EvidenceGrade,
  Sex,
} from "./types";

/**
 * The benchmark scorer. A typed port of tools/benchmarks/scoring.reference.js,
 * kept line-for-line where it matters so the two agree to the decimal.
 *
 * All of the statistics - the age curves, the zero inflation, the floors and
 * ceilings - were computed once, in Python, and baked into the lookup table.
 * This file does not reimplement any of it. It looks a value up, interpolates
 * between the two percentile anchors that bracket it, and handles ties.
 *
 * Conventions, from the methodology report:
 *   continuous, higher is better   score = 100 * F(x)
 *   continuous, lower is better    score = 100 * (1 - F(x))
 *   discrete (reps, 0-10 score)    score = 100 * (P(X < x) + 0.5 * P(X = x))
 *   floor or ceiling               mid-rank within the tied group
 *
 * The mid-rank rule is what guarantees one repetition ranks above everyone
 * who scored zero, however large the zero group is. Zero reps is not a zero
 * score: a man of 55 who does no pull-ups scores about 29, because 58% of
 * his peers also score zero. Do not "fix" this.
 */

export interface EventScore {
  event: string;
  /** 0-100, one decimal. */
  score: number;
  raw: number;
  unit: string;
  sex: Sex;
  /** The age actually used, after clamping to the table's range. */
  age: number;
  evidenceGrade: EvidenceGrade;
  derivation: Derivation;
  /** Grade D. No general-population norm exists yet; this is a model. */
  provisional: boolean;
  atFloor: boolean;
  atCeiling: boolean;
  benchmarkVersion: string;
}

export interface BenchmarkScorer {
  version: string;
  eventKeys: string[];
  scoreEvent(eventKey: string, sex: Sex, age: number, raw: number): EventScore;
  /** Raw value at a percentile, for display: "P75 for men age 40 is 24 push-ups". */
  benchmarkAt(eventKey: string, sex: Sex, age: number, percentile: number): number | null;
  /** The population median, in the event's unit. Null if the event is unknown. */
  medianAt(eventKey: string, sex: Sex, age: number): number | null;
  clampAge(age: number): number;
  event(eventKey: string): BenchmarkEvent | undefined;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export function createScorer(lookup: BenchmarkLookup): BenchmarkScorer {
  if (!lookup || !lookup.events) throw new Error("benchmark lookup missing or malformed");
  const PCTS = lookup.percentiles;

  const clampAge = (age: number) =>
    Math.min(lookup.age_max, Math.max(lookup.age_min, Math.round(age)));

  function scoreContinuous(ev: ContinuousBenchmarkEvent, q: number[], raw: number): number {
    const better = ev.lower_better
      ? (a: number, b: number) => a < b
      : (a: number, b: number) => a > b;

    // Tied at a floor (DNF, 0 m, 0 cm) or a ceiling (60 s cap): mid-rank
    // within the tied group, so everyone who hit the wall gets the same score
    // and nobody who cleared it scores lower.
    if (ev.floor !== null && ev.floor !== undefined) {
      const atFloor = ev.lower_better ? raw >= ev.floor : raw <= ev.floor;
      if (atFloor) {
        const n = q.filter((v) => (ev.lower_better ? v >= ev.floor! : v <= ev.floor!)).length;
        const share = n / q.length; // share of the population at the floor
        return round1(100 * 0.5 * share);
      }
    }
    if (ev.ceiling !== null && ev.ceiling !== undefined && raw >= ev.ceiling) {
      const n = q.filter((v) => v >= ev.ceiling!).length;
      const share = n / q.length;
      return round1(100 * (1 - share + 0.5 * share));
    }

    // Below the 1st percentile anchor / above the 99th.
    if (!better(raw, q[0])) return 0.5;
    if (better(raw, q[q.length - 1])) return 99.5;

    // Linear interpolation between the two bracketing percentile anchors.
    for (let i = 0; i < q.length - 1; i++) {
      const lo = q[i];
      const hi = q[i + 1];
      const inBracket = ev.lower_better ? raw <= lo && raw >= hi : raw >= lo && raw <= hi;
      if (!inBracket) continue;
      const span = hi - lo;
      const frac = Math.abs(span) < 1e-9 ? 0.5 : (raw - lo) / span;
      return round1(PCTS[i] + frac * (PCTS[i + 1] - PCTS[i]));
    }
    /* c8 ignore next */
    return round1(PCTS[PCTS.length - 1]);
  }

  /**
   * Discrete events: mid-rank on the stored CDF.
   *   score = 100 * (P(X < x) + 0.5 * P(X = x))
   */
  function scoreDiscrete(ev: DiscreteBenchmarkEvent, cdf: number[], raw: number): number {
    const grid = ev.grid;
    let i = grid.findIndex((g) => Math.abs(g - raw) < 1e-9);
    if (i === -1) {
      if (raw <= grid[0]) i = 0;
      else if (raw >= grid[grid.length - 1]) {
        // Beyond the stored grid: everyone up there is one tied group.
        return round1(100 * (1 - 0.5 * (1 - cdf[cdf.length - 2])));
      } else i = grid.findIndex((g) => g > raw) - 1; // snap down to the grid
    }
    const below = i === 0 ? 0 : cdf[i - 1];
    const at = cdf[i] - below;
    return round1(100 * (below + 0.5 * at));
  }

  function event(eventKey: string): BenchmarkEvent | undefined {
    return lookup.events[eventKey];
  }

  function scoreEvent(eventKey: string, sex: Sex, age: number, raw: number): EventScore {
    const ev = lookup.events[eventKey];
    if (!ev) throw new Error(`unknown benchmark event: ${eventKey}`);
    if (sex !== "M" && sex !== "F") throw new Error(`sex must be "M" or "F"`);
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new Error(`${eventKey}: raw result must be a finite number, got ${raw}`);
    }
    const a = clampAge(age);
    const key = String(a);
    const score = ev.discrete
      ? scoreDiscrete(ev, ev.cdf[sex][key], raw)
      : scoreContinuous(ev, ev.q[sex][key], raw);

    const atFloor =
      ev.floor !== null && ev.floor !== undefined
        ? ev.lower_better
          ? raw >= ev.floor
          : raw <= ev.floor
        : false;
    const atCeiling = ev.ceiling !== null && ev.ceiling !== undefined && raw >= ev.ceiling;

    return {
      event: eventKey,
      score: Math.min(100, Math.max(0, score)),
      raw,
      unit: ev.unit,
      sex,
      age: a,
      evidenceGrade: ev.grade[sex],
      derivation: ev.derivation[sex][key],
      provisional: ev.grade[sex] === "D",
      atFloor,
      atCeiling,
      benchmarkVersion: lookup.version,
    };
  }

  function benchmarkAt(eventKey: string, sex: Sex, age: number, percentile: number): number | null {
    const ev = lookup.events[eventKey];
    if (!ev) return null;
    const key = String(clampAge(age));
    if (ev.discrete) {
      const cdf = ev.cdf[sex][key];
      const target = percentile / 100;
      for (let i = 0; i < cdf.length; i++) if (cdf[i] >= target - 1e-12) return ev.grid[i];
      return ev.grid[ev.grid.length - 1];
    }
    const idx = PCTS.indexOf(Math.round(percentile));
    return idx === -1 ? null : ev.q[sex][key][idx];
  }

  return {
    version: lookup.version,
    eventKeys: Object.keys(lookup.events),
    scoreEvent,
    benchmarkAt,
    medianAt: (eventKey, sex, age) => benchmarkAt(eventKey, sex, age, 50),
    clampAge,
    event,
  };
}
