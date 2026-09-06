import type { BenchmarkEvent, Derivation, Sex } from "@/lib/scoring/types";

/**
 * Read-side helpers over the table for the methodology and admin pages.
 * Display only; the engine does not use these.
 */

export interface DerivationRange {
  from: number;
  to: number;
  label: Derivation;
}

/** Consecutive ages sharing a derivation label, e.g. 18-69 interpolated, 70-89 extrapolated. */
export function derivationRanges(ev: BenchmarkEvent, sex: Sex): DerivationRange[] {
  const ages = Object.keys(ev.derivation[sex])
    .map(Number)
    .sort((a, b) => a - b);
  const out: DerivationRange[] = [];
  for (const age of ages) {
    const label = ev.derivation[sex][String(age)];
    const last = out[out.length - 1];
    if (last && last.label === label && last.to === age - 1) last.to = age;
    else out.push({ from: age, to: age, label });
  }
  // "observed" is a single source midpoint sitting inside interpolated years;
  // collapse it so the summary reads as spans, not a picket fence.
  const merged: DerivationRange[] = [];
  for (const r of out) {
    const prev = merged[merged.length - 1];
    const fold = (a: Derivation, b: Derivation) =>
      (a === "observed" && b === "interpolated") || (a === "interpolated" && b === "observed");
    if (prev && fold(prev.label, r.label)) {
      prev.to = r.to;
      prev.label = "interpolated";
    } else merged.push({ ...r });
  }
  return merged;
}

export function describeRanges(ranges: DerivationRange[]): string {
  return ranges
    .map((r) => `${r.from}${r.to !== r.from ? `-${r.to}` : ""} ${r.label}`)
    .join(", ");
}

/** "18-69 observed and interpolated from the source, 70-89 extrapolated" in one line, both sexes. */
export function coverageLine(ev: BenchmarkEvent): string {
  const m = describeRanges(derivationRanges(ev, "M"));
  const f = describeRanges(derivationRanges(ev, "F"));
  return m === f ? m : `men ${m}; women ${f}`;
}

export function eventGrades(ev: BenchmarkEvent): string {
  return ev.grade.M === ev.grade.F ? ev.grade.M : `${ev.grade.M} men / ${ev.grade.F} women`;
}
