import type { Direction } from "@/lib/scoring/types";

/**
 * The open-v1 battery, mirroring supabase/migrations/0002_battery_open_v1.sql.
 *
 * This lives in code as well as in Postgres because test mode has to run with
 * no network. The pairing is guarded by a test: unit, capacity and direction
 * must match the norms files, and the norms test asserts there is exactly one
 * file per test and no orphans.
 *
 * A second battery version (65+) is another array like this one plus another
 * INSERT block. Nothing about the scoring engine changes.
 */

export type InputKind = "timer" | "stepper" | "number" | "half_step";

export interface BatteryTest {
  slug: string;
  capacity: string;
  capacityName: string;
  name: string;
  shortName: string;
  unit: string;
  unitLabel: string;
  direction: Direction;
  input: InputKind;
  min: number;
  max: number;
  step: number;
  /** Seconds of rest recommended AFTER this test. */
  restSeconds: number;
  protocol: string;
  /** Two or three words the tester reads out. */
  cue: string;
  demoVideoId: string;
}

export const OPEN_V1_SLUG = "open-v1";

export const OPEN_V1_TESTS: BatteryTest[] = [
  {
    slug: "grip_strength_dynamometer",
    capacity: "grip",
    capacityName: "Grip",
    name: "Grip strength",
    shortName: "Grip",
    unit: "kg",
    unitLabel: "kg",
    direction: "higher_better",
    input: "number",
    min: 5,
    max: 120,
    step: 0.5,
    restSeconds: 120,
    cue: "Squeeze hard, three seconds.",
    protocol:
      "Hand dynamometer. Stand with your arm at your side, elbow at 90 degrees, wrist neutral. Two attempts per hand with 30 seconds between. Record the best attempt on your dominant hand.",
    demoVideoId: "",
  },
  {
    slug: "single_leg_balance_eyes_closed",
    capacity: "balance",
    capacityName: "Balance",
    name: "Single-leg eyes-closed balance",
    shortName: "Balance",
    unit: "s",
    unitLabel: "seconds",
    direction: "higher_better",
    input: "timer",
    min: 0,
    max: 60,
    step: 0.1,
    restSeconds: 120,
    cue: "Hands on hips. Eyes closed. Go.",
    protocol:
      "Hands on hips, eyes closed, stand on one leg. Two attempts per leg. Record the single best attempt across all four. The clock stops when your foot touches down, your eyes open, or your hands leave your hips. Capped at 60 seconds - if you get there, stop.",
    demoVideoId: "",
  },
  {
    slug: "sit_rising_test",
    capacity: "mobility",
    capacityName: "Mobility",
    name: "Sit-rising test",
    shortName: "Sit-rise",
    unit: "points",
    unitLabel: "points",
    direction: "higher_better",
    input: "half_step",
    min: 0,
    max: 10,
    step: 0.5,
    restSeconds: 120,
    cue: "Sit down, stand up. No hands if you can.",
    protocol:
      "Sit down to the floor and stand back up without support. Start at 5 points each way. Subtract 1 point for each hand, knee, forearm or side of leg used for support. Subtract 0.5 for a visible loss of balance. Add the sitting and rising scores.",
    demoVideoId: "",
  },
  {
    slug: "push_ups",
    capacity: "push_endurance",
    capacityName: "Push endurance",
    name: "Push-ups",
    shortName: "Push-ups",
    unit: "reps",
    unitLabel: "reps",
    direction: "higher_better",
    input: "stepper",
    min: 0,
    max: 200,
    step: 1,
    restSeconds: 180,
    cue: "Chest to fist. No pausing at the top.",
    protocol:
      "Strict push-ups, chest to fist height, body in a straight line. The set ends at the first rest longer than 2 seconds at the top, or the first rep that does not reach depth. Same standard for everyone.",
    demoVideoId: "",
  },
  {
    slug: "standing_broad_jump",
    capacity: "leg_power",
    capacityName: "Leg power",
    name: "Standing broad jump",
    shortName: "Broad jump",
    unit: "cm",
    unitLabel: "cm",
    direction: "higher_better",
    input: "number",
    min: 30,
    max: 400,
    step: 1,
    restSeconds: 180,
    cue: "Two feet out, two feet in. Stick it.",
    protocol:
      "Two-foot takeoff, two-foot landing. Two attempts, record the best. Measure from the start line to the rear heel on landing. A hand or seat down behind you voids the attempt.",
    demoVideoId: "",
  },
  {
    slug: "dead_hang",
    capacity: "grip_endurance",
    capacityName: "Grip endurance",
    name: "Dead hang",
    shortName: "Dead hang",
    unit: "s",
    unitLabel: "seconds",
    direction: "higher_better",
    input: "timer",
    min: 0,
    max: 600,
    step: 0.1,
    restSeconds: 180,
    cue: "Overhand. Arms straight. Hang.",
    protocol:
      "Overhand grip on a pull-up bar, arms straight, feet off the ground, no chalk. The clock stops when your feet touch the ground.",
    demoVideoId: "",
  },
  {
    slug: "farmer_carry_half_bw",
    capacity: "loaded_carry",
    capacityName: "Loaded carry",
    name: "Farmer carry",
    shortName: "Carry",
    unit: "m",
    unitLabel: "metres",
    direction: "higher_better",
    input: "number",
    min: 0,
    max: 2000,
    step: 1,
    restSeconds: 180,
    cue: "Half your bodyweight each hand. Walk.",
    protocol:
      "Half your bodyweight in each hand, taken from the bodyweight recorded at the start of this session. Walk on a flat, marked course until your grip fails. Record the distance covered.",
    demoVideoId: "",
  },
  {
    slug: "wall_sit",
    capacity: "leg_isometric",
    capacityName: "Isometric legs",
    name: "Wall sit",
    shortName: "Wall sit",
    unit: "s",
    unitLabel: "seconds",
    direction: "higher_better",
    input: "timer",
    min: 0,
    max: 900,
    step: 0.1,
    restSeconds: 300,
    cue: "Back flat. Knees at 90. Hands off.",
    protocol:
      "Back flat against the wall, knees and hips both at 90 degrees, hands off the thighs. The clock stops when your hips rise above your knees. Five minutes of rest after this one - the 400m is next.",
    demoVideoId: "",
  },
  {
    slug: "run_400m",
    capacity: "speed_endurance",
    capacityName: "Speed endurance",
    name: "400m run",
    shortName: "400m",
    unit: "s",
    unitLabel: "seconds",
    direction: "lower_better",
    input: "timer",
    min: 40,
    max: 400,
    step: 0.01,
    restSeconds: 300,
    cue: "One lap. Hard.",
    protocol:
      "One lap of a track, or a measured flat 400m course. Standing start, timed from first movement. Five minutes of rest after this one before the Cooper run.",
    demoVideoId: "",
  },
  {
    slug: "cooper_12min_run",
    capacity: "aerobic_capacity",
    capacityName: "Aerobic capacity",
    name: "Cooper 12-minute run",
    shortName: "Cooper",
    unit: "m",
    unitLabel: "metres",
    direction: "higher_better",
    input: "number",
    min: 500,
    max: 5000,
    step: 5,
    restSeconds: 0,
    cue: "Twelve minutes. Cover ground.",
    protocol:
      "Cover as much distance as you can in 12 minutes. Always the last test in the battery - it compromises everything measured after it. Take your sit-and-reach and your one-minute recovery heart rate during the warm-down.",
    demoVideoId: "",
  },
];

export const OPEN_V1_TEST_SLUGS = OPEN_V1_TESTS.map((t) => t.slug);

export function testBySlug(slug: string): BatteryTest | undefined {
  return OPEN_V1_TESTS.find((t) => t.slug === slug);
}

/** Unscored measurements captured in the same flow. Never in the composite. */
export const UNSCORED_MEASUREMENTS = [
  {
    kind: "sit_reach" as const,
    name: "Sit-and-reach",
    unit: "cm",
    when: "During the warm-down, after the Cooper run.",
    min: -30,
    max: 60,
    step: 0.5,
  },
  {
    kind: "hr_finish" as const,
    name: "Heart rate at finish",
    unit: "bpm",
    when: "Immediately as the Cooper run ends.",
    min: 60,
    max: 230,
    step: 1,
  },
  {
    kind: "hr_1min" as const,
    name: "Heart rate one minute after",
    unit: "bpm",
    when: "Exactly 60 seconds after the Cooper run ends. The gap between the two is your recovery.",
    min: 40,
    max: 230,
    step: 1,
  },
  {
    kind: "resting_hr" as const,
    name: "Resting heart rate",
    unit: "bpm",
    when: "Optional, taken before you start.",
    min: 30,
    max: 130,
    step: 1,
  },
];

export type UnscoredKind = (typeof UNSCORED_MEASUREMENTS)[number]["kind"];
