import type { BenchmarkLookup } from "@/lib/scoring/types";
import { createScorer } from "@/lib/scoring/benchmark";

import v1_0_0 from "@data/benchmarks/long_game_lookup_v1.0.0.json";

/**
 * Every benchmark version the app can score against, keyed by version.
 *
 * Imported statically rather than fetched so the browser, the server and the
 * share-card renderer all see exactly the same numbers, and so a missing table
 * is a build error rather than a runtime 500. The scoring engine still takes
 * the table as an argument - it never imports this module.
 *
 * Versions are immutable once shipped. A recalibration is a new file and a new
 * key here, never an edit. Results carry the version they were scored under,
 * and are scored on read against that version, so nobody's history moves when
 * a new table lands. See docs/long_game_methodology_v1.0.0.md, section 7.
 */
export const BENCHMARKS: Record<string, BenchmarkLookup> = {
  "1.0.0": v1_0_0 as unknown as BenchmarkLookup,
};

export const CURRENT_BENCHMARK_VERSION = "1.0.0";

export const currentBenchmark: BenchmarkLookup = BENCHMARKS[CURRENT_BENCHMARK_VERSION];

/**
 * The table for a stored version. Falls back to the current one for a result
 * with no stamp (rows written before versions existed) or an unknown stamp,
 * which is the honest default: score it against what we have, and say so.
 */
export function benchmarkFor(version: string | null | undefined): {
  lookup: BenchmarkLookup;
  fellBack: boolean;
} {
  if (version && BENCHMARKS[version]) return { lookup: BENCHMARKS[version], fellBack: false };
  return { lookup: currentBenchmark, fellBack: version != null && version !== "" };
}

/** A ready scorer on the current table, for display helpers and the seed. */
export const scorer = createScorer(currentBenchmark);
