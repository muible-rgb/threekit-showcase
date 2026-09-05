import type { Cohort, NormCohort, NormsFile, Sex } from "./types";

/** Whole years between two dates. Handles leap days the way a birthday does. */
export function ageAt(birthDate: string | Date, at: string | Date): number {
  const b = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  const t = typeof at === "string" ? new Date(at) : at;

  let age = t.getUTCFullYear() - b.getUTCFullYear();
  const monthDiff = t.getUTCMonth() - b.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && t.getUTCDate() < b.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** 5-year band containing `age`. 42 -> [40, 44]. */
export function ageBand(age: number): { min: number; max: number } {
  const min = Math.floor(age / 5) * 5;
  return { min, max: min + 4 };
}

export function cohortFor(
  sex: Sex,
  birthDate: string | Date,
  testedAt: string | Date,
): Cohort {
  const age = ageAt(birthDate, testedAt);
  const band = ageBand(age);
  return { sex, age, ageBandMin: band.min, ageBandMax: band.max };
}

/**
 * Find the norm cohort for a person. If their exact band is missing from the
 * file (someone younger or older than the norms cover), fall back to the
 * nearest band that exists and report that it was clamped - the caller decides
 * whether that matters. It matters for fitness age; it does not for a
 * percentile, where clamping to the edge band is the only honest option.
 */
export function findCohort(
  norms: NormsFile,
  sex: Sex,
  age: number,
): { cohort: NormCohort; clamped: boolean } | null {
  const forSex = norms.cohorts.filter((c) => c.sex === sex);
  if (forSex.length === 0) return null;

  const exact = forSex.find((c) => age >= c.age_min && age <= c.age_max);
  if (exact) return { cohort: exact, clamped: false };

  const sorted = [...forSex].sort((a, b) => a.age_min - b.age_min);
  const youngest = sorted[0];
  const oldest = sorted[sorted.length - 1];
  if (age < youngest.age_min) return { cohort: youngest, clamped: true };
  return { cohort: oldest, clamped: true };
}

/** Age band midpoints present in a file, for one sex, ascending. */
export function bandMidpoints(norms: NormsFile, sex: Sex): number[] {
  return norms.cohorts
    .filter((c) => c.sex === sex)
    .map((c) => (c.age_min + c.age_max) / 2)
    .sort((a, b) => a - b);
}
