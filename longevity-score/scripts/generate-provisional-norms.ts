/**
 * Generates the six norms files for which no adequate published table exists
 * for trained adults: sit-rising, standing broad jump, dead hang, farmer carry,
 * wall sit, and the 400m run.
 *
 * These are PROVISIONAL. The point of generating them from an explicit,
 * committed parameter set rather than typing numbers into JSON is that the
 * assumption is auditable: you can read the anchor, the decline rate and the
 * coefficient of variation, disagree with them, change one line, and regenerate.
 *
 * Model, identical for every file:
 *   mean(age) = anchor42 * (1 - declinePerDecade) ^ ((max(age, peakAge) - 42) / 10)
 *   sd(age)   = cv * mean(age)          (or a fixed sd where the scale is bounded)
 *
 * For lower-is-better tests the decline rate is applied as growth, because
 * getting older makes the number go up.
 *
 * Replace these with re-fits from real app data once a cohort has 30+ results.
 * See TODO_RENORM.md.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "data", "norms", "v1");
const AGE_BANDS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];

type Spec = {
  test_variant: string;
  capacity: string;
  unit: string;
  direction: "higher_better" | "lower_better";
  /** Age at which the mean stops improving. Below this the curve is flat. */
  peakAge: number;
  /** Fractional change per decade past peak. Decline for higher-better tests. */
  declinePerDecade: number;
  /** Mean for a 42-year-old, per sex. 42 is the midpoint of the 40-44 band. */
  anchor42: { M: number; F: number };
  /** SD as a fraction of the mean, or a fixed SD for bounded scales. */
  cv?: number;
  fixedSd?: number;
  decimals: number;
  citation: string;
  url: string;
  population: string;
  notes: string;
};

const SPECS: Spec[] = [
  {
    test_variant: "sit_rising_test",
    capacity: "mobility",
    unit: "points",
    direction: "higher_better",
    peakAge: 25,
    declinePerDecade: 0.07,
    anchor42: { M: 8.4, F: 8.6 },
    fixedSd: 1.6,
    decimals: 1,
    citation:
      "Brito LBB, Ricardo DR, Araujo DSMS, Ramos PS, Myers J, Araujo CGS. Ability to sit and rise from the floor as a predictor of all-cause mortality. Eur J Prev Cardiol. 2014;21(7):892-898.",
    url: "https://doi.org/10.1177/2047487312471759",
    population:
      "Source cohort is 2,002 adults aged 51-80 referred for exercise testing. This battery targets 30-55, which the source barely covers.",
    notes:
      "PROVISIONAL. The source establishes that the SRT predicts mortality and reports score distributions for 51-80 year olds, but does not publish age-and-sex normative tables for the 30-55 range this battery targets. The curve here is anchored at 8.4 (men) / 8.6 (women) at age 42 and declines 7% per decade, which reproduces the source's reported distribution shape at 51-80 within about half a point. Women are anchored slightly higher on the published sex difference in hip and ankle range of motion. The 0-10 ceiling means the top of this scale is compressed: a large share of fit 40-year-olds score a clean 10, so the 90th percentile and above is not well resolved. Re-fit from app data first.",
  },
  {
    test_variant: "standing_broad_jump",
    capacity: "leg_power",
    unit: "cm",
    direction: "higher_better",
    peakAge: 25,
    declinePerDecade: 0.075,
    anchor42: { M: 198, F: 148 },
    cv: 0.14,
    decimals: 0,
    citation:
      "Patterson P, Rethwisch N, Wiksten D. Reliability of the standing long jump. Eurofit test battery reference values, Council of Europe (1993); plus ratings tables compiled in Mackenzie B, 101 Performance Evaluation Tests (2005).",
    url: "https://www.topendsports.com/testing/tests/longjump.htm",
    population:
      "Published tables are dominated by school-age and young athletic populations. Adult 30-55 norms are thin.",
    notes:
      "PROVISIONAL. Broad jump norms for adults over 30 are essentially unpublished; the widely circulated ratings tables are for 16-19 year olds and do not carry age adjustment. The anchor of 198 cm (men) / 148 cm (women) at age 42 sits at the boundary the ratings tables label 'average to above average' for young adults, discounted for age. The 7.5% per decade decline follows published countermovement-jump power decline, which is steeper than strength decline. Coefficient of variation of 0.14 is from reported jump-test variability, not from a normative sample.",
  },
  {
    test_variant: "dead_hang",
    capacity: "grip_endurance",
    unit: "s",
    direction: "higher_better",
    peakAge: 28,
    declinePerDecade: 0.13,
    anchor42: { M: 52, F: 38 },
    cv: 0.45,
    decimals: 0,
    citation:
      "No adequate published normative table. Anchors informed by grip-endurance decline reported in Wang YC et al. (2018) and by climbing-population hang-time distributions.",
    url: "",
    population: "None. This is a construction, not a normative sample.",
    notes:
      "PROVISIONAL, AND THE WEAKEST FILE IN THE SET. There is no general-population dead hang norm. The anchor of 52s (men) / 38s (women) at 42 reflects commonly cited practical benchmarks (30s minimum, 60s good) rather than a measured distribution. The 0.45 coefficient of variation is deliberately wide because dead hang variance is genuinely large and driven by bodyweight and hand size as much as by grip endurance - a heavier person hangs less time at identical grip strength, which this file does not correct for. Treat every dead hang percentile as indicative until re-fit. This is the first file to replace from app data.",
  },
  {
    test_variant: "farmer_carry_half_bw",
    capacity: "loaded_carry",
    unit: "m",
    direction: "higher_better",
    peakAge: 28,
    declinePerDecade: 0.15,
    anchor42: { M: 85, F: 70 },
    cv: 0.5,
    decimals: 0,
    citation:
      "No published normative table for a relative-load (0.5x bodyweight per hand) carry to grip failure.",
    url: "",
    population: "None. This is a construction, not a normative sample.",
    notes:
      "PROVISIONAL. Because the load scales with bodyweight, this test is already partly self-normalising, which is why the sex gap in the anchors is narrower than for absolute-load tests. The anchors come from strength-coaching benchmarks (a 'passing' relative-load carry is usually put at 50-100m). The 0.5 coefficient of variation is wide on purpose: distance to grip failure has heavy right tails. Distance is also surface- and route-dependent, which no norm can absorb - protocol discipline matters more here than on any other test in the battery.",
  },
  {
    test_variant: "wall_sit",
    capacity: "leg_isometric",
    unit: "s",
    direction: "higher_better",
    peakAge: 28,
    declinePerDecade: 0.12,
    anchor42: { M: 78, F: 74 },
    cv: 0.45,
    decimals: 0,
    citation:
      "No adequate published normative table for a 90/90 wall sit in adults. Anchors informed by isometric knee-extension endurance literature.",
    url: "",
    population: "None. This is a construction, not a normative sample.",
    notes:
      "PROVISIONAL. Wall sit hold times are widely reported anecdotally (60s average, 90s+ good) but not normatively. The sex gap in the anchors is small because the test is bodyweight-relative and women hold isometric positions comparably well in the published isometric endurance literature. Knee angle discipline dominates the measurement: a few degrees above 90 adds tens of seconds, so this file assumes the strict 90/90 protocol is actually enforced.",
  },
  {
    test_variant: "run_400m",
    capacity: "speed_endurance",
    unit: "s",
    direction: "lower_better",
    peakAge: 26,
    declinePerDecade: 0.075,
    anchor42: { M: 84, F: 98 },
    cv: 0.16,
    decimals: 1,
    citation:
      "No general-population 400m normative table. Anchors informed by World Masters Athletics age-grading factors applied to recreational (not competitive) baselines.",
    url: "https://world-masters-athletics.org/",
    population:
      "Masters age-grading factors are derived from competitive masters athletes, which is a much fitter population than this battery's target.",
    notes:
      "PROVISIONAL. The age-decline shape here (7.5% per decade past 26) is taken from Masters age-grading, which is well established. The anchor - 84s (men) / 98s (women) at age 42 - is not: it is a recreational baseline, set roughly 55% slower than masters-competitive times for that age. The decline shape is the trustworthy part of this file; the absolute level is not. This is the only lower-is-better test in the battery, so it is also the one most likely to expose a direction bug - it is covered explicitly in the engine tests.",
  },
];

function meanAt(spec: Spec, sex: "M" | "F", age: number): number {
  const a = Math.max(age, spec.peakAge);
  const exponent = (a - 42) / 10;
  const base = spec.anchor42[sex];
  const factor =
    spec.direction === "lower_better"
      ? Math.pow(1 + spec.declinePerDecade, exponent)
      : Math.pow(1 - spec.declinePerDecade, exponent);
  return base * factor;
}

function round(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

for (const spec of SPECS) {
  const cohorts: Array<Record<string, unknown>> = [];
  for (const sex of ["M", "F"] as const) {
    for (const ageMin of AGE_BANDS) {
      const midpoint = ageMin + 2;
      const mean = meanAt(spec, sex, midpoint);
      const sd = spec.fixedSd ?? (spec.cv ?? 0.2) * mean;
      cohorts.push({
        sex,
        age_min: ageMin,
        age_max: ageMin + 4,
        mean: round(mean, spec.decimals),
        sd: round(sd, Math.max(spec.decimals, 1)),
      });
    }
  }

  const doc = {
    test_variant: spec.test_variant,
    capacity: spec.capacity,
    unit: spec.unit,
    direction: spec.direction,
    norms_version: "v1",
    source: {
      citation: spec.citation,
      url: spec.url,
      population: spec.population,
      provisional: true,
      transcription_verified: false,
      notes: spec.notes,
      generated_by: "scripts/generate-provisional-norms.ts",
      model: {
        form: "mean(age) = anchor42 * (1 -/+ declinePerDecade) ^ ((max(age, peakAge) - 42) / 10)",
        peak_age: spec.peakAge,
        decline_per_decade: spec.declinePerDecade,
        anchor_age_42: spec.anchor42,
        ...(spec.fixedSd !== undefined
          ? { fixed_sd: spec.fixedSd }
          : { coefficient_of_variation: spec.cv }),
      },
    },
    cohorts,
  };

  const path = join(OUT_DIR, `${spec.test_variant}.json`);
  writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
  console.log(`wrote ${spec.test_variant}.json (${cohorts.length} cohorts)`);
}
