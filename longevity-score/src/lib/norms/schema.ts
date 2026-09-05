import type { NormsFile } from "@/lib/scoring/types";

export interface ValidationIssue {
  file: string;
  level: "error" | "warning";
  message: string;
}

/**
 * Structural validation for a norms file. Run in CI and by /admin/norms.
 *
 * This is deliberately strict about the things that would silently produce a
 * wrong percentile - a missing direction, a cohort with neither format, a
 * cut-point table that runs the wrong way - and only warning-level about
 * coverage gaps, which are a known and documented state in v1.
 */
export function validateNormsFile(raw: unknown, fileName: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (message: string) =>
    issues.push({ file: fileName, level: "error", message });
  const warn = (message: string) =>
    issues.push({ file: fileName, level: "warning", message });

  if (typeof raw !== "object" || raw === null) {
    err("not an object");
    return issues;
  }
  const f = raw as Partial<NormsFile>;

  for (const key of ["test_variant", "capacity", "unit", "direction", "norms_version"] as const) {
    if (typeof f[key] !== "string" || f[key] === "") err(`missing ${key}`);
  }
  if (f.direction !== "higher_better" && f.direction !== "lower_better") {
    err(`direction must be higher_better or lower_better, got ${String(f.direction)}`);
  }

  if (!f.source) {
    err("missing source block");
  } else {
    if (!f.source.citation) err("source.citation is empty - every number needs a source");
    if (typeof f.source.provisional !== "boolean") err("source.provisional must be a boolean");
    if (f.source.provisional && !f.source.notes) {
      err("a provisional file must carry notes explaining why");
    }
    if (f.source.transcription_verified !== true) {
      warn("numbers have not been verified against the source document");
    }
  }

  if (!Array.isArray(f.cohorts) || f.cohorts.length === 0) {
    err("no cohorts");
    return issues;
  }

  const seen = new Set<string>();
  for (const c of f.cohorts) {
    const label = `${c.sex} ${c.age_min}-${c.age_max}`;

    if (c.sex !== "M" && c.sex !== "F") err(`cohort ${label}: sex must be M or F`);
    if (!Number.isFinite(c.age_min) || !Number.isFinite(c.age_max)) {
      err(`cohort ${label}: age bounds must be numbers`);
      continue;
    }
    if (c.age_max - c.age_min !== 4) {
      err(`cohort ${label}: bands must be 5 years wide`);
    }
    if (seen.has(label)) err(`cohort ${label}: duplicate`);
    seen.add(label);

    const hasMeanSd = c.mean !== undefined && c.sd !== undefined;
    const hasPercentiles = c.percentiles !== undefined;

    if (hasMeanSd === hasPercentiles) {
      err(`cohort ${label}: must have exactly one of mean+sd or percentiles`);
      continue;
    }

    if (hasMeanSd) {
      if (!Number.isFinite(c.mean) || !Number.isFinite(c.sd)) {
        err(`cohort ${label}: mean and sd must be numbers`);
      } else if (c.sd! <= 0) {
        err(`cohort ${label}: sd must be positive`);
      }
    }

    if (hasPercentiles) {
      const pts = Object.entries(c.percentiles!)
        .map(([p, v]) => ({ p: Number(p), v }))
        .sort((a, b) => a.p - b.p);

      if (pts.length < 2) err(`cohort ${label}: needs at least two cut-points`);
      for (const { p, v } of pts) {
        if (!Number.isFinite(p) || p <= 0 || p >= 100) {
          err(`cohort ${label}: percentile key ${p} out of range`);
        }
        if (!Number.isFinite(v)) err(`cohort ${label}: cut-point at ${p} is not a number`);
      }

      // A table running the wrong way is the single most dangerous bug in a
      // norms file: it silently inverts everyone's score. Catch it here.
      for (let i = 1; i < pts.length; i++) {
        const rising = pts[i].v > pts[i - 1].v;
        const falling = pts[i].v < pts[i - 1].v;
        if (f.direction === "higher_better" && falling) {
          err(
            `cohort ${label}: higher_better but the ${pts[i].p}th cut-point (${pts[i].v}) is below the ${pts[i - 1].p}th (${pts[i - 1].v})`,
          );
        }
        if (f.direction === "lower_better" && rising) {
          err(
            `cohort ${label}: lower_better but the ${pts[i].p}th cut-point (${pts[i].v}) is above the ${pts[i - 1].p}th (${pts[i - 1].v})`,
          );
        }
      }
    }
  }

  for (const sex of ["M", "F"] as const) {
    const forSex = f.cohorts.filter((c) => c.sex === sex);
    if (forSex.length === 0) {
      err(`no cohorts for sex ${sex}`);
      continue;
    }
    const min = Math.min(...forSex.map((c) => c.age_min));
    const max = Math.max(...forSex.map((c) => c.age_max));
    if (min > 30 || max < 55) {
      warn(`${sex} coverage is ${min}-${max}; the v1 target range is 30-55`);
    }
    // Gaps mean someone's age band silently falls back to a neighbour.
    const mins = forSex.map((c) => c.age_min).sort((a, b) => a - b);
    for (let i = 1; i < mins.length; i++) {
      if (mins[i] - mins[i - 1] !== 5) {
        warn(`${sex} has a gap between the ${mins[i - 1]} and ${mins[i]} bands`);
      }
    }
  }

  return issues;
}
