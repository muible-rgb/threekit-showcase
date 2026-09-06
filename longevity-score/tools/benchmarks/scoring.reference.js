/**
 * The Long Game - scoring module (benchmark lookup v1.0.0)
 *
 * Zero dependencies. Load long_game_lookup_v1.0.0.json and pass it in.
 * All math the benchmarks need is already baked into the table; this file
 * only does lookup, interpolation and tie handling.
 *
 *   import { createScorer } from "./scoring.js";
 *   const lookup = await fetch("/benchmarks/long_game_lookup_v1.0.0.json").then(r => r.json());
 *   const scorer = createScorer(lookup);
 *   scorer.scoreEvent("mile_run", "M", 39, 402);   // -> { score: 89.6, ... }
 *   scorer.scoreBattery("M", 39, { mile_run: 402, pull_ups: 8, ... });
 *
 * EVENT KEYS AND RAW UNITS (store raw exactly like this, forever):
 *   mile_run              seconds   (1800 = DNF / over 30:00)
 *   pull_ups              reps      (integer, 0 valid)
 *   push_ups              reps      (integer, 0 valid, 2-minute cap)
 *   broad_jump            cm        (0 = unable)
 *   farmer_carry          meters    (0 = unable to lift)
 *   pro_agility_5_10_5    seconds   (30 = DNF)
 *   single_leg_balance_ec seconds   (60 = cap)
 *   sit_to_rise           0-10 in 0.5 steps
 */

export const EVENT_KEYS = [
  "mile_run",
  "pull_ups",
  "push_ups",
  "broad_jump",
  "farmer_carry",
  "pro_agility_5_10_5",
  "single_leg_balance_ec",
  "sit_to_rise",
];

export function createScorer(lookup) {
  if (!lookup || !lookup.events) throw new Error("lookup table missing or malformed");
  const PCTS = lookup.percentiles; // [1..99]

  const clampAge = (age) => Math.min(89, Math.max(18, Math.round(age)));

  /** Continuous events: invert the quantile array. */
  function scoreContinuous(ev, q, raw) {
    const better = ev.lower_better ? (a, b) => a < b : (a, b) => a > b;

    // Tied at a floor (DNF, 0 m, 0 cm) or a ceiling (60 s cap): mid-rank
    // within the tied group, so everyone who hit the wall gets the same score
    // and nobody who cleared it scores lower.
    if (ev.floor !== null && ev.floor !== undefined) {
      const atFloor = ev.lower_better ? raw >= ev.floor : raw <= ev.floor;
      if (atFloor) {
        const n = q.filter((v) => (ev.lower_better ? v >= ev.floor : v <= ev.floor)).length;
        const share = n / q.length; // share of population at the floor
        return round1(100 * 0.5 * share);
      }
    }
    if (ev.ceiling !== null && ev.ceiling !== undefined && raw >= ev.ceiling) {
      const n = q.filter((v) => v >= ev.ceiling).length;
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
    return round1(PCTS[PCTS.length - 1]);
  }

  /**
   * Discrete events: mid-rank on the stored CDF.
   *   score = 100 * (P(X < x) + 0.5 * P(X = x))
   * This is what guarantees that one repetition ranks above everyone who
   * scored zero, however large the zero group is.
   */
  function scoreDiscrete(ev, cdf, raw) {
    const grid = ev.grid;
    let i = grid.findIndex((g) => Math.abs(g - raw) < 1e-9);
    if (i === -1) {
      if (raw <= grid[0]) i = 0;
      else if (raw >= grid[grid.length - 1]) return round1(100 * (1 - 0.5 * (1 - cdf[cdf.length - 2])));
      else i = grid.findIndex((g) => g > raw) - 1; // snap down to the grid
    }
    const below = i === 0 ? 0 : cdf[i - 1];
    const at = cdf[i] - below;
    return round1(100 * (below + 0.5 * at));
  }

  function scoreEvent(eventKey, sex, age, raw) {
    const ev = lookup.events[eventKey];
    if (!ev) throw new Error(`unknown event: ${eventKey}`);
    if (sex !== "M" && sex !== "F") throw new Error(`sex must be "M" or "F"`);
    if (raw === null || raw === undefined || Number.isNaN(raw)) throw new Error("raw result required");
    const a = clampAge(age);
    const score = ev.discrete
      ? scoreDiscrete(ev, ev.cdf[sex][a], raw)
      : scoreContinuous(ev, ev.q[sex][a], raw);
    return {
      event: eventKey,
      score,
      raw,
      unit: ev.unit,
      sex,
      age: a,
      evidenceGrade: ev.grade[sex],
      derivation: ev.derivation[sex][a],
      provisional: ev.grade[sex] === "D",
      benchmarkVersion: lookup.version,
    };
  }

  /** All eight events. Overall = arithmetic mean (MVP rule, equal weights). */
  function scoreBattery(sex, age, results) {
    const events = {};
    for (const key of EVENT_KEYS) {
      if (results[key] === undefined || results[key] === null) continue;
      events[key] = scoreEvent(key, sex, age, results[key]);
    }
    const done = Object.values(events);
    const complete = done.length === EVENT_KEYS.length;
    const overall = done.length ? round1(done.reduce((s, e) => s + e.score, 0) / done.length) : null;
    return {
      overall,
      complete,
      eventsScored: done.length,
      events,
      benchmarkVersion: lookup.version,
      // Overall is a MEAN OF PERCENTILES, not a percentile. Roughly: 70 is
      // strong, 80 is top ~10%, 90 is top ~2-3%. Never label it "Xth percentile".
      overallLabel: "Longevity Score",
    };
  }

  /** For display: "P75 for men age 40 is 24 push-ups". */
  function benchmarkAt(eventKey, sex, age, percentile) {
    const ev = lookup.events[eventKey];
    const a = clampAge(age);
    if (ev.discrete) {
      const cdf = ev.cdf[sex][a];
      const target = percentile / 100;
      for (let i = 0; i < cdf.length; i++) if (cdf[i] >= target - 1e-12) return ev.grid[i];
      return ev.grid[ev.grid.length - 1];
    }
    const idx = PCTS.indexOf(Math.round(percentile));
    return idx === -1 ? null : ev.q[sex][a][idx];
  }

  return { scoreEvent, scoreBattery, benchmarkAt, version: lookup.version, EVENT_KEYS };
}

function round1(x) {
  return Math.round(x * 10) / 10;
}
