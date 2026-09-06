import type { Direction } from "@/lib/scoring/types";

/**
 * The eight-test battery. Imperial units.
 *
 * There is no guided mode and no fixed order. You look at eight rows, tap one,
 * type the number you got. The app is a scorecard, not a coach - it does not
 * time you, it does not tell you when to rest, and it does not care which one
 * you do first.
 *
 * A future cohort battery (65+, say) is another array like this one plus
 * another INSERT. The scoring engine does not change: the composite is always
 * the mean of one percentile per capacity.
 */

export type InputKind = "number" | "reps" | "time" | "half_step" | "load_distance";

export interface BatteryTest {
  slug: string;
  capacity: string;
  capacityName: string;
  name: string;
  shortName: string;
  /** Machine unit, matching the norms file. */
  unit: string;
  /** What the user sees next to the input. */
  unitLabel: string;
  direction: Direction;
  input: InputKind;
  min: number;
  max: number;
  step: number;
  /** One line. What counts as a rep, where the clock stops. */
  standard: string;
  /** The full protocol, for /methodology and the entry sheet. */
  protocol: string;
  demoVideoId: string;
  /**
   * A second captured number, where the scored one needs context. The carry
   * records the load you actually held: 300 feet at 40 lb a hand and 300 feet
   * at 90 lb are not the same result, and the norm assumes half bodyweight.
   */
  secondary?: {
    label: string;
    unit: string;
    unitLabel: string;
    min: number;
    max: number;
  };
}

export const BATTERY_SLUG = "open-v2";

export const BATTERY_TESTS: BatteryTest[] = [
  {
    slug: "mile_run",
    capacity: "aerobic_capacity",
    capacityName: "Aerobic",
    name: "Mile",
    shortName: "Mile",
    unit: "s",
    unitLabel: "time",
    direction: "lower_better",
    input: "time",
    min: 240,
    max: 1800,
    step: 1,
    standard: "One mile, as fast as you can hold.",
    protocol:
      "One mile on a track or a measured flat course. Four laps of a standard 400m track is 1600m, near enough. Standing start, timed to the finish.",
    demoVideoId: "",
  },
  {
    slug: "pull_ups",
    capacity: "pull_strength",
    capacityName: "Pull",
    name: "Pull-ups",
    shortName: "Pull-ups",
    unit: "reps",
    unitLabel: "reps",
    direction: "higher_better",
    input: "reps",
    min: 0,
    max: 100,
    step: 1,
    standard: "Dead hang to chin over the bar. No kipping.",
    protocol:
      "Start from a full dead hang, arms straight. Chin clears the bar, then back to straight arms. No kipping, no swinging. The set ends at the first rep that does not clear.",
    demoVideoId: "",
  },
  {
    slug: "push_ups",
    capacity: "push_endurance",
    capacityName: "Push",
    name: "Push-ups",
    shortName: "Push-ups",
    unit: "reps",
    unitLabel: "reps",
    direction: "higher_better",
    input: "reps",
    min: 0,
    max: 200,
    step: 1,
    standard: "Chest to fist height. No resting at the top.",
    protocol:
      "Strict push-ups, body in a straight line, chest to fist height. The set ends at the first rest longer than two seconds at the top, or the first rep that does not reach depth.",
    demoVideoId: "",
  },
  {
    slug: "broad_jump",
    capacity: "leg_power",
    capacityName: "Power",
    name: "Broad jump",
    shortName: "Jump",
    unit: "in",
    unitLabel: "inches",
    direction: "higher_better",
    input: "number",
    min: 12,
    max: 160,
    step: 1,
    standard: "Two feet out, two feet in. Best of three.",
    protocol:
      "Two-foot takeoff, two-foot landing. Measure from the start line to the rear heel. Best of three attempts. A hand or seat down behind you voids the attempt.",
    demoVideoId: "",
  },
  {
    slug: "farmer_carry",
    capacity: "loaded_carry",
    capacityName: "Carry",
    name: "Carry",
    shortName: "Carry",
    unit: "ft",
    unitLabel: "feet",
    direction: "higher_better",
    input: "load_distance",
    min: 0,
    max: 3000,
    step: 5,
    standard: "Half your bodyweight per hand. Walk till your grip goes.",
    protocol:
      "Half your bodyweight in each hand. Walk a flat, marked course until your grip fails and you have to put them down. Record what you held and how far you got. The norms assume half bodyweight per hand - carry lighter or heavier and the distance is not comparable, so the app says so rather than quietly scoring it anyway.",
    demoVideoId: "",
    secondary: {
      label: "Load per hand",
      unit: "lb",
      unitLabel: "lb",
      min: 5,
      max: 300,
    },
  },
  {
    slug: "agility_5_10_5",
    capacity: "agility",
    capacityName: "Agility",
    name: "Agility",
    shortName: "Agility",
    unit: "s",
    unitLabel: "seconds",
    direction: "lower_better",
    input: "number",
    min: 3,
    max: 20,
    step: 0.01,
    standard: "5-10-5 shuttle. Best of two.",
    protocol:
      "The 5-10-5 pro agility shuttle. Straddle the middle line, sprint 5 yards to one side and touch the line, 10 yards back the other way and touch, then 5 yards through the middle. Best of two.",
    demoVideoId: "",
  },
  {
    slug: "balance_eyes_closed",
    capacity: "balance",
    capacityName: "Balance",
    name: "Balance",
    shortName: "Balance",
    unit: "s",
    unitLabel: "seconds",
    direction: "higher_better",
    input: "number",
    min: 0,
    max: 60,
    step: 0.5,
    standard: "One leg, eyes closed, hands on hips. Capped at 60s.",
    protocol:
      "Hands on hips, eyes closed, stand on one leg. Best single attempt. The clock stops when your foot touches down, your eyes open, or your hands leave your hips. Capped at 60 seconds.",
    demoVideoId: "",
  },
  {
    slug: "sit_to_rise",
    capacity: "mobility",
    capacityName: "Mobility",
    name: "Sit-to-rise",
    shortName: "Sit-to-rise",
    unit: "points",
    unitLabel: "points",
    direction: "higher_better",
    input: "half_step",
    min: 0,
    max: 10,
    step: 0.5,
    standard: "Down and up off the floor. 10 points, lose one per hand down.",
    protocol:
      "Sit down to the floor and stand back up without support. Start at 5 points each way. Subtract 1 for each hand, knee, forearm or side of leg you lean on. Subtract 0.5 for a visible wobble. Add the two halves.",
    demoVideoId: "",
  },
];

export const BATTERY_TEST_SLUGS = BATTERY_TESTS.map((t) => t.slug);
export const BATTERY_TEST_COUNT = BATTERY_TESTS.length;

export function testBySlug(slug: string): BatteryTest | undefined {
  return BATTERY_TESTS.find((t) => t.slug === slug);
}

/**
 * Bodyweight, in pounds. Not scored - it is here because the carry load is
 * derived from it, and because a carry distance means nothing without it.
 */
export const BODYWEIGHT_UNIT = "lb";

/**
 * Bodyweight rides on a solo session row rather than a second storage concept.
 */
export const SOLO_SESSION_ID = "solo";

/**
 * How far the load strayed from the protocol's half-bodyweight, as a fraction.
 * 0 means exactly on protocol; 0.25 means a quarter light or heavy.
 *
 * Returns null when we cannot tell - no bodyweight on file, or no load
 * recorded - because "we do not know" and "on protocol" are different answers.
 */
export function carryLoadDrift(
  loadPerHandLb: number | null | undefined,
  bodyweightLb: number | null | undefined,
): number | null {
  if (!loadPerHandLb || !bodyweightLb || bodyweightLb <= 0) return null;
  const expected = bodyweightLb / 2;
  return (loadPerHandLb - expected) / expected;
}

/** Outside this, the distance is not comparable to the norm. */
export const CARRY_LOAD_TOLERANCE = 0.15;
