import type { Direction, Sex, TestBinding } from "@/lib/scoring/types";

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
  /**
   * Which benchmark event scores this test, and how to get from the unit the
   * app stores (what people say out loud: feet, inches) to the unit the table
   * speaks (metres, centimetres). raw_in_event_units = raw * factor.
   */
  benchmark: { event: string; factor: number };
  /**
   * The value recorded for "could not finish". Shares the floor with everyone
   * else who could not, and is scored mid-rank in that group - a real result
   * in the low tail, not missing data.
   */
  dnfValue?: number;
  /** One line. What counts as a rep, where the clock stops. */
  standard: string;
  /** The full protocol, for /methodology and the entry sheet. */
  protocol: string;
  demoVideoId: string;
  /**
   * A second captured number, where the scored one needs context. The carry
   * records the load you actually held: 300 feet at 40 lb a hand and 300 feet
   * at 90 lb are not the same result, and the norm assumes the prescribed
   * load for your sex.
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
    benchmark: { event: "mile_run", factor: 1 },
    dnfValue: 1800,
    standard: "One mile, as fast as you can hold.",
    protocol:
      "One mile on a track or a measured flat course. Four laps of a standard 400m track is 1600m, near enough. Run, jog or walk - standing start, timed to the finish, no pause in the clock. 30:00 cap: slower than that, or unable to finish, is recorded as a did-not-finish and scored with everyone else who could not.",
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
    benchmark: { event: "pull_ups", factor: 1 },
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
    benchmark: { event: "push_ups", factor: 1 },
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
    benchmark: { event: "broad_jump", factor: 2.54 },
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
    benchmark: { event: "farmer_carry", factor: 0.3048 },
    standard: "50 lb in each hand, 35 for women. Walk till your grip goes.",
    protocol:
      "50 lb in each hand for men, 35 for women - a pair of dumbbells or kettlebells, same weight both sides. Walk a flat, marked course until your grip fails and you have to put them down. Record what you held and how far you got. The load is prescribed rather than worked out from your bodyweight, so what makes distances comparable is your age and sex cohort, not the weight on the handle. If the prescribed load is not what you own, enter what you carried - the app marks it off-protocol rather than quietly scoring it as if it matched.",
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
    max: 30,
    step: 0.01,
    benchmark: { event: "pro_agility_5_10_5", factor: 1 },
    dnfValue: 30,
    standard: "5-10-5 shuttle. Best of two.",
    protocol:
      "The 5-10-5 pro agility shuttle. Straddle the middle line, sprint 5 yards to one side and touch the line, 10 yards back the other way and touch, then 5 yards through the middle. Hand-timed to a tenth. Best of two. Unable to attempt is recorded as a did-not-finish.",
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
    benchmark: { event: "single_leg_balance_ec", factor: 1 },
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
    benchmark: { event: "sit_to_rise", factor: 1 },
    standard: "Down and up off the floor. 10 points, lose one per hand down.",
    protocol:
      "Sit down to the floor and stand back up without support. Start at 5 points each way. Subtract 1 for each hand, knee, forearm or side of leg you lean on. Subtract 0.5 for a visible wobble. Add the two halves.",
    demoVideoId: "",
  },
];

export const BATTERY_TEST_SLUGS = BATTERY_TESTS.map((t) => t.slug);
export const BATTERY_TEST_COUNT = BATTERY_TESTS.length;

/** The eight tests as the scoring engine sees them: slug, event, unit factor. */
export const BATTERY_BINDINGS: TestBinding[] = BATTERY_TESTS.map((t) => ({
  slug: t.slug,
  capacity: t.capacity,
  unit: t.unit,
  event: t.benchmark.event,
  factor: t.benchmark.factor,
}));

export function testBySlug(slug: string): BatteryTest | undefined {
  return BATTERY_TESTS.find((t) => t.slug === slug);
}

/**
 * The carry runs at a prescribed load, not a fraction of your bodyweight.
 *
 * Scaling the load to bodyweight made this the only test in the battery that
 * asked what you weigh, and put it at 90 lb a hand for a big man, which is not
 * a dumbbell most gyms own. The prescription is by sex rather than one number
 * for everyone: 50 and 35 are rack standards, and 35 for a woman is close to
 * the same relative load as 50 for a man, which keeps the test measuring grip
 * endurance rather than who can pick the things up at all.
 */
export const CARRY_LOAD_LB: Record<Sex, number> = { M: 50, F: 35 };

/**
 * How far the load strayed from the prescribed one, as a fraction. 0 means on
 * protocol; 0.25 means a quarter light or heavy.
 *
 * Returns null when no load was recorded, because "we do not know" and "on
 * protocol" are different answers.
 */
export function carryLoadDrift(
  loadPerHandLb: number | null | undefined,
  sex: Sex,
): number | null {
  if (!loadPerHandLb || loadPerHandLb <= 0) return null;
  const prescribed = CARRY_LOAD_LB[sex];
  return (loadPerHandLb - prescribed) / prescribed;
}

/** Outside this, the distance is not comparable to the norm. */
export const CARRY_LOAD_TOLERANCE = 0.15;
