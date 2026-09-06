import type { Cohort, Sex } from "./types";

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

/**
 * 5-year band containing `age`. 42 -> [40, 44].
 *
 * Scoring no longer uses bands - the benchmark table has a column for every
 * single year of age, so a 44-year-old and a 45-year-old are scored against
 * 44- and 45-year-olds. The band survives as a display grouping: it is how
 * the board filters and how a cohort is named on screen.
 */
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
